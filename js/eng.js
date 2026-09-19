/* =========================================================
   FRUTLOG - ENGENHEIRO AGRONOMO
   Monitoramento, telemetria, colheita e cadastro de plantio.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  FrutLog.verificarSessao(["engenheiro"]);
  FrutLog.configurarLogout();

  const botoesTalhao = document.querySelectorAll(".btn-talhao");
  const talhoesMapa = document.querySelectorAll(".talhao-mapa");
  const filtrosGrafico = document.querySelectorAll(".btn-filtro");
  const formularioPlantio = document.getElementById("formulario-plantio");
  const mensagemPlantio = document.getElementById("mensagem-plantio");
  let graficoColheita = null;
  let unidadeAtual = "toneladas";

  // Dados locais de apresentacao ate a API oficial estar disponivel.
  const dadosTalhoes = {
    A1: {
      status: "Normal",
      produto: "Uva",
      variedade: "Uva Isabel",
      area: "10 hectares",
      solo: "Arenoso",
      plantio: "15/03/2026",
      colheita: "20/10/2026",
      apontamentoTecnico: {
        data: "13/09/2026",
        tecnico: "Marina",
        problema: "Sem problema registrado.",
        recomendacao: "Manter rotina de acompanhamento.",
      },
      diaria: { temperatura: "31", umidadeAr: "68", umidadeSolo: "45", chuva: "2,4" },
      mensal: [
        { temp: "30", umidAr: "65", umidSolo: "45", chuva: "12", prev: "Out/2026", qtd: "25 t" },
        { temp: "31", umidAr: "68", umidSolo: "42", chuva: "8", prev: "Out/2026", qtd: "28 t" },
      ],
    },
    A2: {
      status: "Atencao",
      produto: "Manga",
      variedade: "Tommy Atkins",
      area: "8 hectares",
      solo: "Franco Arenoso",
      plantio: "10/02/2026",
      colheita: "18/09/2026",
      apontamentoTecnico: {
        data: "13/09/2026",
        tecnico: "Marina",
        problema: "Umidade do solo abaixo do ideal.",
        recomendacao: "Verificar irrigacao e acompanhar nas proximas leituras.",
      },
      diaria: { temperatura: "33", umidadeAr: "61", umidadeSolo: "35", chuva: "1,8" },
      mensal: [
        { temp: "32", umidAr: "60", umidSolo: "38", chuva: "5", prev: "Set/2026", qtd: "40 t" },
        { temp: "33", umidAr: "61", umidSolo: "35", chuva: "2", prev: "Set/2026", qtd: "42 t" },
      ],
    },
    B1: {
      status: "Normal",
      produto: "Uva",
      variedade: "Sugar Crisp",
      area: "9 hectares",
      solo: "Arenoso",
      plantio: "05/02/2026",
      colheita: "25/09/2026",
      apontamentoTecnico: {
        data: "13/09/2026",
        tecnico: "Marina",
        problema: "Sem problema registrado.",
        recomendacao: "Manter rotina de acompanhamento.",
      },
      diaria: { temperatura: "30", umidadeAr: "72", umidadeSolo: "48", chuva: "3,1" },
      mensal: [
        { temp: "29", umidAr: "70", umidSolo: "50", chuva: "15", prev: "Set/2026", qtd: "30 t" },
        { temp: "30", umidAr: "72", umidSolo: "48", chuva: "10", prev: "Set/2026", qtd: "35 t" },
      ],
    },
    B2: {
      status: "Critico",
      produto: "Melao",
      variedade: "Goldex",
      area: "7,6 hectares",
      solo: "Franco Arenoso",
      plantio: "20/01/2026",
      colheita: "15/09/2026",
      apontamentoTecnico: {
        data: "12/09/2026",
        tecnico: "Marina",
        problema: "Sensor de solo offline e leitura critica de umidade.",
        recomendacao: "Priorizar vistoria em campo e checar irrigacao.",
      },
      diaria: { temperatura: "35", umidadeAr: "54", umidadeSolo: "28", chuva: "0,8" },
      mensal: [
        { temp: "34", umidAr: "55", umidSolo: "30", chuva: "0", prev: "Set/2026", qtd: "18 t" },
        { temp: "35", umidAr: "54", umidSolo: "28", chuva: "1", prev: "Set/2026", qtd: "20 t" },
      ],
    },
  };

  const colheitas = [
    { ano: "2022", toneladas: 72, media: "0,20 t/dia" },
    { ano: "2023", toneladas: 84, media: "0,23 t/dia" },
    { ano: "2024", toneladas: 79, media: "0,22 t/dia" },
    { ano: "2025", toneladas: 91, media: "0,25 t/dia" },
    { ano: "2026", toneladas: 105, media: "0,29 t/dia" },
  ];

  function classeStatus(status) {
    return status.toLowerCase().replace("ç", "c").replace("ã", "a");
  }

  function preencherTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.textContent = valor;
    }
  }

  function atualizarTabelaDiaria(dados) {
    const tabela = document.getElementById("tabela-telemetria-diaria");
    if (!tabela) return;

    tabela.innerHTML = `
      <tr>
        <td>${dados.temperatura}</td>
        <td>${dados.umidadeAr}</td>
        <td>${dados.umidadeSolo}</td>
        <td>${dados.chuva}</td>
      </tr>
    `;
  }

  function atualizarTabelaMensal(dadosMensais) {
    const tabela = document.getElementById("tabela-talhao-mensal");
    if (!tabela) return;

    tabela.innerHTML = dadosMensais.map((item) => `
      <tr>
        <td>${item.temp}</td>
        <td>${item.umidAr}</td>
        <td>${item.umidSolo}</td>
        <td>${item.chuva}</td>
        <td>${item.prev}</td>
        <td>${item.qtd}</td>
      </tr>
    `).join("");
  }

  function selecionarTalhao(nomeTalhao) {
    const dados = dadosTalhoes[nomeTalhao];
    if (!dados) return;

    botoesTalhao.forEach((botao) => {
      botao.classList.toggle("active", botao.dataset.talhao === nomeTalhao);
    });

    talhoesMapa.forEach((talhao) => {
      talhao.classList.toggle("selecionado", talhao.dataset.talhao === nomeTalhao);
    });

    preencherTexto("titulo-talhao", `Detalhes: Talhao ${nomeTalhao}`);
    preencherTexto("talhao-area", dados.area);
    preencherTexto("talhao-solo", dados.solo);
    preencherTexto("talhao-plantio", dados.plantio);
    preencherTexto("talhao-colheita", dados.colheita);
    preencherTexto("talhao-produto", `${dados.produto} ${dados.variedade}`);
    preencherTexto("talhao-inspecao-data", dados.apontamentoTecnico.data);
    preencherTexto("talhao-inspecao-tecnico", dados.apontamentoTecnico.tecnico);
    preencherTexto("talhao-inspecao-problema", dados.apontamentoTecnico.problema);
    preencherTexto("talhao-inspecao-recomendacao", dados.apontamentoTecnico.recomendacao);

    const badge = document.getElementById("talhao-status");
    if (badge) {
      badge.textContent = dados.status;
      badge.className = `badge-status ${classeStatus(dados.status)}`;
    }

    atualizarTabelaDiaria(dados.diaria);
    atualizarTabelaMensal(dados.mensal);
  }

  function atualizarResumoColheita() {
    const ordenadas = [...colheitas].sort((a, b) => a.toneladas - b.toneladas);
    const menor = ordenadas[0];
    const maior = ordenadas[ordenadas.length - 1];
    const ultima = colheitas[colheitas.length - 1];
    const fator = unidadeAtual === "sacas" ? 16.67 : 1;
    const sufixo = unidadeAtual === "sacas" ? "sacas" : "toneladas";

    preencherTexto("resumo-ultima-data", ultima.ano);
    preencherTexto("resumo-ultima-valor", `${Math.round(ultima.toneladas * fator)} ${sufixo}`);
    preencherTexto("resumo-ultima-media", `Media: ${ultima.media}`);
    preencherTexto("resumo-menor-data", menor.ano);
    preencherTexto("resumo-menor-valor", `${Math.round(menor.toneladas * fator)} ${sufixo}`);
    preencherTexto("resumo-menor-media", `Media: ${menor.media}`);
    preencherTexto("resumo-maior-data", maior.ano);
    preencherTexto("resumo-maior-valor", `${Math.round(maior.toneladas * fator)} ${sufixo}`);
    preencherTexto("resumo-maior-media", `Media: ${maior.media}`);
  }

  function carregarGraficoColheita() {
    const canvas = document.getElementById("graficoColheita");
    if (!canvas || typeof Chart === "undefined") return;

    const fator = unidadeAtual === "sacas" ? 16.67 : 1;
    const rotulo = unidadeAtual === "sacas" ? "Sacas" : "Toneladas";
    const valores = colheitas.map((item) => Math.round(item.toneladas * fator));

    if (graficoColheita) {
      graficoColheita.destroy();
    }

    graficoColheita = new Chart(canvas, {
      type: "bar",
      data: {
        labels: colheitas.map((item) => item.ano),
        datasets: [{
          label: rotulo,
          data: valores,
          backgroundColor: "#2e7d32",
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });

    atualizarResumoColheita();
  }

  async function registrarPlantio(evento) {
    evento.preventDefault();

    const dadosFormulario = Object.fromEntries(new FormData(formularioPlantio));

    try {
      // TODO: confirmar endpoint com o backend.
      // await FrutLog.apiFetch("/plantios", { method: "POST", body: JSON.stringify(dadosFormulario) });
      console.info("Plantio pronto para envio futuro:", dadosFormulario);
      mensagemPlantio.textContent = "Cadastro preparado para envio ao backend.";
      mensagemPlantio.className = "mensagem-feedback sucesso";
      formularioPlantio.reset();
    } catch (erro) {
      mensagemPlantio.textContent = erro.message;
      mensagemPlantio.className = "mensagem-feedback erro";
    }
  }

  botoesTalhao.forEach((botao) => {
    botao.addEventListener("click", () => selecionarTalhao(botao.dataset.talhao));
  });

  talhoesMapa.forEach((talhao) => {
    talhao.addEventListener("click", () => selecionarTalhao(talhao.dataset.talhao));
  });

  filtrosGrafico.forEach((botao) => {
    botao.addEventListener("click", () => {
      unidadeAtual = botao.dataset.unidade;
      filtrosGrafico.forEach((item) => item.classList.toggle("active", item === botao));
      carregarGraficoColheita();
    });
  });

  if (formularioPlantio) {
    formularioPlantio.addEventListener("submit", registrarPlantio);
  }

  selecionarTalhao("A1");
  carregarGraficoColheita();
});
