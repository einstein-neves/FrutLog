/* =========================================================================
   FRUTLOG - TELEMETRIA POR TALHAO
   =========================================================================

   O QUE ESTE ARQUIVO E
   --------------------
   O painel de telemetria de UM talhao por vez: os botoes de selecao, os tres
   cartoes de valor atual e os tres graficos de historico recente.

   POR QUE E COMPARTILHADO
   -----------------------
   Admin, Engenheiro e Tecnico tinham tres telemetrias DIFERENTES:

     admin        painel do ThingSpeak, nivel de canal, sem talhao
     engenheiro   uma linha so, do talhao selecionado no mapa, sem coluna
     tecnico      tabela com coluna de talhao e filtro

   Tres implementacoes da mesma ideia divergem com o tempo -- foi o que
   aconteceu com o julgamento do talhao, que o Predador precisou unificar
   depois. Entao aqui existe UMA, e as tres telas chamam a mesma.

   DE ONDE VEM O DADO
   ------------------
   GET /telemetria/talhao/:codigo, que devolve leitura CRUA do banco:

     { talhao, consultado_em, metricas: { temperatura: { unidade, pontos } } }

   Nao e o painel do ThingSpeak: aquele le a nuvem direto e nao sabe o que e
   talhao. Este le o historico que a ponte gravou -- entao sobrevive ao
   ThingSpeak sair do ar, e e por talhao.

   OS TRES ESTADOS DE UMA METRICA
   ------------------------------
   Esta e a razao de o painel antigo nao servir. Ele mostrava "--" para duas
   situacoes diferentes:

     33.6 °C          valor real
     sem leitura      sensor cadastrado que nao respondeu   <- PROBLEMA
     nao cadastrado   nao existe sensor dessa metrica aqui  <- normal

   Com o sensor de solo desligado, o painel vivia cheio de "--" que nao eram
   problema nenhum. Isso ensina a ignorar a coluna, e no dia em que o sensor
   existir e parar de responder o aviso vai parecer igual ao normal de hoje.
   A rota distingue os dois casos: metrica cadastrada aparece em `metricas`
   com `pontos: []`; metrica sem sensor nao aparece.

   COMO USAR
   ---------
     <div id="telemetria-talhao"></div>

     FrutLogTelemetria.montar({ containerId: "telemetria-talhao" });
     FrutLogTelemetria.definirTalhoes(["T14", "A1"]);   // preenche os botoes
   ========================================================================= */

const FrutLogTelemetria = (() => {
  // As metricas que o painel desenha, na ordem em que aparecem. As cores sao
  // as mesmas do grafico do ThingSpeak, para a mesma grandeza ter a mesma cor
  // em qualquer lugar do sistema.
  const METRICAS = [
    { chave: "temperatura", nome: "Temperatura", unidade: "°C", cor: "#2e7d32" },
    { chave: "umidadeAr", nome: "Umidade do ar", unidade: "%", cor: "#061b61" },
    { chave: "umidadeSolo", nome: "Umidade do solo", unidade: "%", cor: "#ef6c00" },
  ];

  // De quanto em quanto tempo o painel rebusca. 60s casa com o ritmo da ponte
  // (PONTE_INTERVALO_SEGUNDOS): pedir mais rapido nao traria dado novo.
  const INTERVALO_MS = 60000;

  // Quantos pontos desenhar. A rota devolve ate 600 leituras; a cada 20s isso
  // e mais de 3 horas. Desenhar tudo deixa o grafico ilegivel, entao
  // amostramos.
  //
  // Comecou em 60 e baixou para 24 depois de comparar lado a lado com o
  // dashboard do Node-RED: num grafico de ~300px de largura, 60 pontos viram
  // serrilha e a linha fica suja. Com 24 o formato da curva aparece, que e o
  // que interessa -- o valor exato de cada ponto quem da e o cartao acima.
  const MAXIMO_PONTOS = 24;

  let container = null;
  let codigos = [];
  let selecionado = "";
  let temporizador = null;
  const graficos = new Map();

  /** Escapa texto antes de ir para innerHTML. Cada tela tem a sua; aqui o
   *  modulo precisa ser independente, entao carrega a propria. */
  // HILCCER ROCHA DE ARAUJO MELO ALTERACAO: renomeada de escapar para escaparHtml (mesmo nome usado no resto do projeto)
  function escaparHtml(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
  }

  /** Data e hora por extenso. Usada na linha de status, onde o dia importa. */
  function formatarHora(iso) {
    if (!iso) return "--";
    const data = new Date(iso);
    return Number.isNaN(data.getTime()) ? "--" : data.toLocaleString("pt-BR");
  }

  /** So a hora, para o eixo X do grafico.
   *  Com data completa ("02/11/2026, 01:41:38") o eixo virava uma parede de
   *  texto que escondia a propria curva -- era a maior fonte de poluicao
   *  visual quando comparado lado a lado com o dashboard do Node-RED. A data
   *  continua visivel na linha "ultima leitura", acima dos cartoes. */
  function formatarApenasHora(iso) {
    if (!iso) return "";
    const data = new Date(iso);
    return Number.isNaN(data.getTime())
      ? ""
      : data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  /** Quanto tempo faz, em texto curto. O numero sozinho nao diz se e de agora
   *  ou de semana passada -- foi essa confusao que fez "Temperatura Atual"
   *  mostrar media de setembro como se fosse a leitura do momento. */
  function idadeEmTexto(iso) {
    if (!iso) return "";
    const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!Number.isFinite(minutos)) return "";
    if (minutos < 1) return "agora";
    if (minutos < 60) return `há ${minutos} min`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `há ${horas} h`;
    return `há ${Math.round(horas / 24)} dia(s)`;
  }

  /**
   * Decide em qual dos tres estados uma metrica esta.
   *
   * Separada do desenho de proposito: e a regra que motivou este painel
   * inteiro, entao precisa poder ser testada sem navegador. Ver o cabecalho
   * deste arquivo para o porque de "--" nao servir.
   *
   * @param {{unidade?: string, pontos?: Array}|undefined} dados - o que a rota
   *   devolveu para esta metrica. `undefined` significa que nao ha sensor
   *   dessa metrica no talhao; objeto com `pontos: []` significa que o sensor
   *   existe e ainda nao mandou nada.
   * @param {{unidade: string}} metrica - a definicao fixa, usada como unidade
   *   de reserva quando o cadastro nao informou uma.
   * @returns {{valor: string, classe: string}}
   */
  function estadoDaMetrica(dados, metrica) {
    if (!dados) return { valor: "não cadastrado", classe: "sem-sensor" };

    const ultimo = dados.pontos?.[dados.pontos.length - 1];
    if (!ultimo) return { valor: "sem leitura", classe: "sem-leitura" };

    return {
      valor: `${ultimo.valor} ${dados.unidade || metrica.unidade}`,
      classe: "com-valor",
    };
  }

  /** Monta a estrutura fixa do painel uma unica vez.
   *
   *  IDEMPOTENTE de proposito. As telas chamam isto de dentro da funcao que
   *  recarrega o painel, e essa funcao tambem roda no refresh automatico. Sem
   *  a guarda abaixo, cada ciclo refazia o innerHTML: os canvas eram
   *  substituidos por outros novos, e as instancias de Chart.js apontando para
   *  os antigos ficavam vivas na memoria, acumulando a cada minuto. */
  function montar(opcoes) {
    const alvo = document.getElementById(opcoes?.containerId);
    if (!alvo) return;
    if (container === alvo && container.querySelector("[data-graficos-telemetria]")) return;

    container = alvo;

    container.innerHTML = `
      <div class="cabecalho-telemetria-talhao">
        <div class="titulo-cartao">
          <i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i> Telemetria por talhão
        </div>
        <div class="botoes-talhao-telemetria" data-botoes-telemetria role="group"
          aria-label="Selecionar talhão"></div>
      </div>
      <p class="mensagem-feedback" data-status-telemetria aria-live="polite">Carregando telemetria...</p>
      <div class="thingspeak-summary" data-cartoes-telemetria></div>
      <div class="graficos-telemetria" data-graficos-telemetria></div>

      <!-- Tabela das leituras, uma por linha. E o unico bloco que o grafico
        nao substitui: o grafico mostra a FORMA da curva, a tabela mostra o
        valor exato com horario. Veio para dentro deste painel porque a versao
        do cartao do ThingSpeak era do canal inteiro, sem talhao -- e repetia
        numeros que os cartoes acima ja mostram. -->
      <details class="tabela-telemetria-talhao" data-tabela-telemetria open>
        <summary>Leituras registradas</summary>
        <div class="tabela-responsiva">
          <table class="tabela-dados">
            <thead>
              <tr>
                <th>Data/hora</th>
                ${METRICAS.map((metrica) => `<th>${escaparHtml(metrica.nome)} (${escaparHtml(metrica.unidade)})</th>`).join("")}
              </tr>
            </thead>
            <tbody data-linhas-telemetria></tbody>
          </table>
        </div>
      </details>
    `;

    // Delegacao: os botoes sao recriados a cada definirTalhoes(), entao o
    // ouvinte fica no pai, que nunca e substituido.
    container.querySelector("[data-botoes-telemetria]")?.addEventListener("click", (evento) => {
      const botao = evento.target.closest("[data-talhao-telemetria]");
      if (botao) selecionar(botao.dataset.talhaoTelemetria);
    });

    // Um canvas por metrica, criados de uma vez. Chart.js precisa do elemento
    // existindo antes de desenhar.
    const area = container.querySelector("[data-graficos-telemetria]");
    area.innerHTML = METRICAS.map((metrica) => `
      <div class="grafico-metrica" data-grafico="${metrica.chave}">
        <div class="titulo-grafico-metrica">${escaparHtml(metrica.nome)} (${escaparHtml(metrica.unidade)})</div>
        <div class="area-grafico-metrica"><canvas aria-label="Histórico de ${escaparHtml(metrica.nome)}"></canvas></div>
        <p class="detalhe-origem" data-aviso="${metrica.chave}"></p>
      </div>
    `).join("");

    if (!temporizador) {
      temporizador = window.setInterval(() => {
        // Aba em segundo plano nao precisa de dado fresco: economiza
        // requisicao e evita somar contra o limite de 120/min do servidor.
        if (!document.hidden) atualizar();
      }, INTERVALO_MS);
    }
  }

  /** Recebe a lista de talhoes existentes e redesenha os botoes.
   *  Criou talhao novo? A tela chama isto de novo e ele aparece sozinho. */
  function definirTalhoes(lista) {
    codigos = (lista || []).map((item) => String(item?.properties?.codigo ?? item)).filter(Boolean);
    if (!container) return;

    const area = container.querySelector("[data-botoes-telemetria]");
    if (!area) return;

    if (!codigos.includes(selecionado)) selecionado = codigos[0] || "";

    area.innerHTML = codigos.map((codigo) => {
      const ativo = codigo === selecionado ? " active" : "";
      return `<button class="btn-talhao${ativo}" type="button" aria-pressed="${codigo === selecionado}"
        data-talhao-telemetria="${escaparHtml(codigo)}">${escaparHtml(codigo)}</button>`;
    }).join("");

    if (selecionado) atualizar();
    else mostrarStatus("Nenhum talhão ativo para monitorar.");
  }

  function selecionar(codigo) {
    if (!codigo || codigo === selecionado) return;
    selecionado = codigo;
    definirTalhoes(codigos);
  }

  function mostrarStatus(texto) {
    const alvo = container?.querySelector("[data-status-telemetria]");
    if (alvo) alvo.textContent = texto;
  }

  /** Busca o dado do talhao selecionado e redesenha cartoes e graficos. */
  async function atualizar() {
    if (!container || !selecionado) return;

    let resposta;
    try {
      resposta = await FrutLog.apiFetch(`/telemetria/talhao/${encodeURIComponent(selecionado)}`);
    } catch (erro) {
      // Falha de rede nao limpa o que ja esta na tela: o ultimo dado bom
      // continua valendo, com o aviso ao lado. Apagar o grafico a cada
      // oscilacao de rede seria pior que mostrar dado de um minuto atras.
      mostrarStatus(`Não foi possível atualizar: ${erro.message}`);
      return;
    }

    const metricas = resposta?.metricas || {};
    desenharCartoes(metricas);
    desenharGraficos(metricas);
    desenharTabela(metricas);

    // A idade da leitura mais recente entre todas as metricas.
    const ultimoEm = Object.values(metricas)
      .map((metrica) => metrica.pontos?.[metrica.pontos.length - 1]?.em)
      .filter(Boolean)
      .sort()
      .pop();

    mostrarStatus(ultimoEm
      ? `Talhão ${selecionado} · última leitura ${formatarHora(ultimoEm)} · ${idadeEmTexto(ultimoEm)}`
      : `Talhão ${selecionado} · nenhuma leitura registrada ainda.`);
  }

  function desenharCartoes(metricas) {
    const area = container.querySelector("[data-cartoes-telemetria]");
    if (!area) return;

    area.innerHTML = METRICAS.map((metrica) => {
      const { valor, classe } = estadoDaMetrica(metricas[metrica.chave], metrica);
      return `<article class="cartao-metrica ${classe}">
        <span>${escaparHtml(metrica.nome)} (${escaparHtml(metrica.unidade)})</span>
        <strong>${escaparHtml(valor)}</strong>
      </article>`;
    }).join("");
  }

  // Quantas linhas a tabela mostra. As leituras chegam a cada 20s, entao 50
  // linhas cobrem ~17 minutos -- o suficiente para conferir valor exato sem a
  // pagina virar uma lista infinita. O historico completo e o grafico que da.
  const MAXIMO_LINHAS = 50;

  /**
   * Preenche a tabela de leituras, uma linha por horario.
   *
   * A rota entrega os dados POR METRICA, cada uma com sua lista de pontos. A
   * tabela precisa do contrario: uma linha por instante, com as metricas em
   * colunas. Por isso o agrupamento por horario abaixo.
   *
   * As leituras de um mesmo DHT chegam com o mesmo `coletado_em`, entao caem
   * na mesma linha naturalmente. Sensores independentes (um sensor de solo
   * proprio, por exemplo) marcam horarios proprios e geram linhas separadas --
   * o que e honesto: eles mediram em momentos diferentes mesmo.
   */
  function desenharTabela(metricas) {
    const corpo = container.querySelector("[data-linhas-telemetria]");
    if (!corpo) return;

    const porHorario = new Map();
    for (const metrica of METRICAS) {
      for (const ponto of metricas[metrica.chave]?.pontos || []) {
        if (!porHorario.has(ponto.em)) porHorario.set(ponto.em, {});
        porHorario.get(ponto.em)[metrica.chave] = ponto.valor;
      }
    }

    // Mais recente primeiro: quem abre a tabela quer saber o agora, nao o
    // comeco do historico.
    const linhas = [...porHorario.entries()]
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
      .slice(0, MAXIMO_LINHAS);

    const colunas = METRICAS.length + 1;
    if (!linhas.length) {
      corpo.innerHTML = `<tr><td colspan="${colunas}">Nenhuma leitura registrada neste talhão.</td></tr>`;
      return;
    }

    corpo.innerHTML = linhas.map(([em, valores]) => `
      <tr>
        <td>${escaparHtml(formatarHora(em))}</td>
        ${METRICAS.map((metrica) => {
          const valor = valores[metrica.chave];
          // "--" aqui significa so "esta metrica nao mediu neste instante".
          // A distincao entre "sem sensor" e "sensor mudo" fica nos cartoes,
          // que e onde ela muda o que a pessoa deve fazer.
          return `<td>${valor === undefined ? "--" : escaparHtml(valor)}</td>`;
        }).join("")}
      </tr>
    `).join("");
  }

  function desenharGraficos(metricas) {
    for (const metrica of METRICAS) {
      const bloco = container.querySelector(`[data-grafico="${metrica.chave}"]`);
      const canvas = bloco?.querySelector("canvas");
      const aviso = container.querySelector(`[data-aviso="${metrica.chave}"]`);
      if (!canvas) continue;

      const dados = metricas[metrica.chave];
      const pontos = dados?.pontos || [];

      // Grafico anterior precisa morrer antes do novo nascer: Chart.js mantem
      // o canvas registrado e recusa desenhar duas vezes no mesmo elemento.
      const anterior = graficos.get(metrica.chave);
      if (anterior) {
        anterior.destroy();
        graficos.delete(metrica.chave);
      }

      if (!dados) {
        if (aviso) aviso.textContent = "Nenhum sensor desta métrica cadastrado neste talhão.";
        continue;
      }
      if (!pontos.length) {
        if (aviso) aviso.textContent = "Sensor cadastrado, aguardando a primeira leitura.";
        continue;
      }
      if (aviso) aviso.textContent = `${pontos.length} leitura(s) no período.`;

      if (typeof Chart === "undefined") {
        if (aviso) aviso.textContent = "Gráficos indisponíveis neste navegador.";
        continue;
      }

      // Amostra: com uma leitura a cada 20s, 600 pontos viram um borrao.
      const passo = Math.max(1, Math.ceil(pontos.length / MAXIMO_PONTOS));
      const amostra = pontos.filter((_, indice) => indice % passo === 0);

      graficos.set(metrica.chave, new Chart(canvas, {
        type: "line",
        data: {
          labels: amostra.map((ponto) => formatarApenasHora(ponto.em)),
          datasets: [{
            label: `${metrica.nome} (${dados.unidade || metrica.unidade})`,
            data: amostra.map((ponto) => ponto.valor),
            borderColor: metrica.cor,
            backgroundColor: `${metrica.cor}22`,
            fill: true,
            spanGaps: true,
            tension: 0.25,
            pointRadius: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            // No hover a data completa volta: no eixo ela poluia, mas quando o
            // usuario aponta um ponto especifico e exatamente o que ele quer
            // saber -- "esse pico foi quando?".
            tooltip: {
              callbacks: {
                title: (itens) => formatarHora(amostra[itens[0]?.dataIndex]?.em),
              },
            },
          },
          interaction: { mode: "index", intersect: false },
          // Limita quantos rotulos aparecem no eixo. Sem isso o Chart.js tenta
          // escrever todos os 24 e eles se empilham na diagonal.
          scales: {
            // Limita quantos rotulos de hora aparecem. Sem isso o Chart.js
            // tenta escrever os 24 e eles se empilham na diagonal.
            x: { ticks: { maxTicksLimit: 6, maxRotation: 0, autoSkip: true } },
            // beginAtZero fica false de proposito: a variacao de temperatura
            // num pomar e de poucos graus, e forcar o eixo a comecar no zero
            // achataria a linha ate parecer que nada muda.
            y: { beginAtZero: false },
          },
        },
      }));
    }
  }

  return {
    METRICAS,
    estadoDaMetrica,
    montar,
    definirTalhoes,
    selecionar,
    atualizar,
  };
})();
