/* =========================================================================
   FrutLog - PREDADOR: o que deve virar alerta registrado
   =========================================================================

   POR QUE ESTE ARQUIVO EXISTE
   ---------------------------
   Ate agora o Predador diagnosticava e esquecia. A tabela `alerta` nunca
   recebia uma linha, e isso custava tres coisas:

     1. nao havia historico -- "quantas vezes o T4 passou do teto em outubro?"
        era uma pergunta sem resposta;
     2. nao havia o que notificar, porque nao havia evento registrado;
     3. nao havia ROTULO. O Degrau 3 (machine learning) precisa de exemplos
        marcados por gente: "esse alerta era real" / "esse era alarme falso".
        Sem a linha na tabela nao existe o que marcar, e sem marcacao nao ha
        o que a maquina aprender.

   O QUE ELE FAZ E O QUE ELE NAO FAZ
   ---------------------------------
   Ele DECIDE. Nao escreve. Recebe os diagnosticos do nucleo e os alertas que
   ja estao abertos, e devolve um plano: o que abrir, o que fechar, o que
   deixar quieto. Quem grava e a casca que tem acesso ao banco.

   A separacao e a mesma do predador-nucleo.js, pelo mesmo motivo: sem
   `require` nenhum, isto roda em teste sem banco, sem rede e sem .env. Uma
   regra que so pode ser testada ligando no Supabase na pratica nao e testada.

   AS DUAS DECISOES DIFICEIS
   -------------------------
   1. NAO REPETIR. O Predador roda de minuto em minuto. Se cada passagem
      abrisse um alerta, um dia quente geraria 1.440 linhas do mesmo problema
      e a tela viraria lixo. Por isso existe a CHAVE: talhao + motivo. Mesma
      chave ja aberta = nao abre de novo.

      E por isso que o nucleo passou a devolver `motivo`, um codigo estavel.
      Comparar a MENSAGEM nao funcionaria: ela carrega a temperatura, entao
      "33.1°C ultrapassou" e "33.2°C ultrapassou" seriam problemas diferentes
      aos olhos do programa, e abririam dois alertas por causa de um decimo
      de grau.

   2. QUANDO FECHAR -- e aqui mora a parte contra-intuitiva.
      Fecha-se um alerta quando o problema passou. Mas "o sensor parou de
      responder" NAO e prova de que o problema passou: pode ser justamente o
      calor que derrubou o aparelho. Fechar um alerta de estresse hidrico
      porque o sensor emudeceu seria o sistema dizendo "resolvido" na hora de
      maior risco.

      Entao so fecha com status NORMAL (estamos vendo, e esta bom) ou
      SEM_CICLO (foi colhido, nao ha mais o que proteger). Em SEM_DADOS o
      alerta FICA ABERTO, de proposito.
   ========================================================================= */

// Titulo legivel de cada motivo. Ele e tambem a CHAVE de deduplicacao, porque
// e o que fica gravado em alerta.titulo -- assim a mesma coluna serve para a
// pessoa ler e para o programa reconhecer. Mudar um texto daqui faz o sistema
// perder de vista os alertas ja abertos com o texto antigo: se precisar mudar,
// feche os abertos antes ou trate a migracao.
const TITULO_POR_MOTIVO = {
  ESTRESSE_HIDRICO: "Estresse hídrico",
  SOLO_SECO: "Umidade do solo abaixo do mínimo",
  TEMPERATURA_ACIMA: "Temperatura acima do limite",
};

// Status em que podemos AFIRMAR que nao ha problema agora.
// SEM_DADOS esta fora de proposito -- ver "QUANDO FECHAR" no cabecalho.
const STATUS_QUE_ENCERRAM = new Set(["NORMAL", "SEM_CICLO"]);

/** Chave de identidade de um problema: o mesmo talhao com o mesmo motivo. */
function chaveDe(talhaoId, titulo) {
  return `${talhaoId}|${titulo}`;
}

/**
 * Monta o plano de alertas a partir do que o nucleo diagnosticou.
 *
 * @param {object} entrada
 * @param {Array}  entrada.diagnosticos   saida de diagnosticarTalhoes()
 * @param {Array}  entrada.alertasAbertos linhas de `alerta` com status=aberto
 * @param {string} [entrada.agora]        ISO; injetavel para o teste nao
 *                                        depender do relogio da maquina
 * @returns {{abrir: Array, fechar: Array, manter: Array}}
 */
function planejarAlertas(entrada) {
  const diagnosticos = entrada.diagnosticos || [];
  const alertasAbertos = entrada.alertasAbertos || [];
  const agora = entrada.agora || new Date().toISOString();

  // O Predador so mexe no que o Predador escreveu.
  //
  // A tabela `alerta` e compartilhada: a RPC registrar_ocorrencia_com_alerta
  // abre alerta quando um tecnico relata algo em campo ("Ocorrencia de campo:
  // Falta de agua"), e problema_sensor abre outro tipo. Sem este filtro, a
  // primeira rodada do vigia FECHARIA esses alertas -- a IA resolvendo
  // sozinha um problema relatado por uma pessoa, que ela nem sabe o que e.
  //
  // O criterio e o titulo: os que o Predador escreve saem todos de
  // TITULO_POR_MOTIVO. Qualquer outro titulo e de outro dono e nao se toca.
  const titulosDoPredador = new Set(Object.values(TITULO_POR_MOTIVO));

  // Talhoes que ESTA rodada avaliou. Alerta de talhao fora da lista fica como
  // esta: o Predador nao viu aquele talhao, entao nao tem o que afirmar sobre
  // ele. E o caso do talhao arquivado, que sai do diagnostico mas pode ter
  // alerta aberto de quando estava em operacao.
  const talhoesAvaliados = new Set(diagnosticos.map((d) => d.talhao_id));

  // Indice do que ja esta aberto, para responder "isso ja foi avisado?".
  const abertosPorChave = new Map();
  for (const alerta of alertasAbertos) {
    if (!titulosDoPredador.has(alerta.titulo)) continue;
    if (!talhoesAvaliados.has(alerta.talhao_id)) continue;
    abertosPorChave.set(chaveDe(alerta.talhao_id, alerta.titulo), alerta);
  }

  const abrir = [];
  const manter = [];
  // Comeca com todos os abertos e vai riscando os que seguem valendo. O que
  // sobrar no fim e problema que nao foi mais diagnosticado.
  const candidatosAFechar = new Map(abertosPorChave);

  for (const diagnostico of diagnosticos) {
    const titulo = TITULO_POR_MOTIVO[diagnostico.motivo];

    // Sem alerta ou sem titulo conhecido nao ha o que registrar. O aviso
    // previo (TEMPERATURA_PROXIMA) cai aqui de proposito: ele pinta o mapa de
    // amarelo mas nao toca a sirene, senao a lista encheria de avisos sem
    // acao e o engenheiro pararia de olhar.
    if (!diagnostico.alerta || !titulo) {
      if (STATUS_QUE_ENCERRAM.has(diagnostico.status)) continue;
      // Status que nao encerra (SEM_DADOS): protege TODOS os alertas deste
      // talhao de serem fechados nesta passagem.
      for (const chave of [...candidatosAFechar.keys()]) {
        if (chave.startsWith(`${diagnostico.talhao_id}|`)) candidatosAFechar.delete(chave);
      }
      continue;
    }

    const chave = chaveDe(diagnostico.talhao_id, titulo);
    candidatosAFechar.delete(chave);

    const jaAberto = abertosPorChave.get(chave);
    if (jaAberto) {
      // Ja avisado. Nao abre outro -- mas vale atualizar a mensagem, porque a
      // temperatura de agora e mais util que a de uma hora atras.
      manter.push({ id: jaAberto.id, mensagem: diagnostico.mensagem });
      continue;
    }

    abrir.push({
      talhao_id: diagnostico.talhao_id,
      titulo,
      mensagem: diagnostico.mensagem,
      severidade: diagnostico.severidade,
      status: "aberto",
      aberto_em: agora,
    });
  }

  // Sobrou aberto e o problema nao foi mais diagnosticado: o talhao voltou ao
  // normal ou foi colhido. Fecha com `resolvido`, que e o estado do enum para
  // "acabou". Note que quem resolveu foi a lavoura, nao uma pessoa: por isso
  // resolvido_por fica nulo e isso e informacao, nao falha.
  const fechar = [...candidatosAFechar.values()].map((alerta) => ({
    id: alerta.id,
    status: "resolvido",
    resolvido_em: agora,
    fechado_em: agora,
    observacao_resolucao: "Condição normalizada: o Predador deixou de diagnosticar o problema.",
  }));

  return { abrir, fechar, manter };
}

module.exports = {
  TITULO_POR_MOTIVO,
  STATUS_QUE_ENCERRAM,
  planejarAlertas,
};
