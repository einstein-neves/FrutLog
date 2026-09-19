/* =========================================================
   FRUTLOG - ADMINISTRADOR
   Funcionarios, usuarios ativos, mapa e indicadores.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  FrutLog.verificarSessao(["admin"]);
  FrutLog.configurarLogout();
  gerarMatriculaFuncionario();
  carregarSessoes();
  configurarCadastroFuncionario();
  carregarGraficos();
});

const sessoesAtivas = [
  {
    matricula: "1001",
    nome: "Carlos",
    perfil: "engenheiro",
    ultimoAcesso: "13/09/2026 08:10",
    ultimaAtividade: "13/09/2026 09:20",
    status: "Online",
  },
  {
    matricula: "2001",
    nome: "Marina",
    perfil: "tecnico",
    ultimoAcesso: "13/09/2026 07:45",
    ultimaAtividade: "13/09/2026 09:28",
    status: "Online",
  },
  {
    matricula: "3001",
    nome: "Roberto",
    perfil: "admin",
    ultimoAcesso: "12/09/2026 16:40",
    ultimaAtividade: "12/09/2026 17:05",
    status: "Offline",
  },
];

const colheitaAnual = [
  { ano: "2022", toneladas: 72 },
  { ano: "2023", toneladas: 84 },
  { ano: "2024", toneladas: 79 },
  { ano: "2025", toneladas: 91 },
  { ano: "2026", toneladas: 105 },
];

const climaMensal = [
  { mes: "Jan", temperatura: 33, chuva: 22 },
  { mes: "Fev", temperatura: 32, chuva: 18 },
  { mes: "Mar", temperatura: 31, chuva: 28 },
  { mes: "Abr", temperatura: 30, chuva: 16 },
  { mes: "Mai", temperatura: 29, chuva: 12 },
  { mes: "Jun", temperatura: 28, chuva: 8 },
  { mes: "Jul", temperatura: 29, chuva: 6 },
  { mes: "Ago", temperatura: 31, chuva: 9 },
  { mes: "Set", temperatura: 32, chuva: 14 },
  { mes: "Out", temperatura: 33, chuva: 20 },
  { mes: "Nov", temperatura: 32, chuva: 26 },
  { mes: "Dez", temperatura: 31, chuva: 30 },
];

let proximaMatriculaFuncionario = 4001;

function gerarMatriculaFuncionario() {
  const campoMatricula = document.getElementById("funcionario-matricula");

  if (campoMatricula) {
    campoMatricula.value = proximaMatriculaFuncionario;
  }
}

function carregarSessoes() {
  const tabela = document.getElementById("tabela-sessoes");
  if (!tabela) return;

  tabela.innerHTML = sessoesAtivas.map((sessao) => {
    const statusClasse = sessao.status.toLowerCase();

    return `
      <tr>
        <td>${sessao.matricula}</td>
        <td>${sessao.nome}</td>
        <td>${sessao.perfil}</td>
        <td>${sessao.ultimoAcesso}</td>
        <td>${sessao.ultimaAtividade}</td>
        <td>
          <span class="status-usuario ${statusClasse}">
            <span class="bolinha-status" aria-hidden="true"></span>
            ${sessao.status}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

function configurarCadastroFuncionario() {
  const formulario = document.getElementById("form-funcionario");
  const mensagem = document.getElementById("mensagem-funcionario");

  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));

    try {
      // TODO: confirmar endpoint com o backend.
      // await FrutLog.apiFetch("/funcionarios", { method: "POST", body: JSON.stringify(dados) });
      console.info("Funcionario preparado para API:", dados);
      mensagem.textContent = "Cadastro de funcionario preparado para envio ao backend.";
      mensagem.className = "mensagem-feedback sucesso";
      proximaMatriculaFuncionario += 1;
      formulario.reset();
      gerarMatriculaFuncionario();
    } catch (erro) {
      mensagem.textContent = erro.message;
      mensagem.className = "mensagem-feedback erro";
    }
  });
}

function carregarGraficos() {
  if (typeof Chart === "undefined") {
    return;
  }

  const graficoColheita = document.getElementById("grafico-colheita-anual");
  const graficoClima = document.getElementById("grafico-clima-mensal");

  if (graficoColheita) {
    new Chart(graficoColheita, {
      type: "bar",
      data: {
        labels: colheitaAnual.map((item) => item.ano),
        datasets: [{
          label: "Toneladas",
          data: colheitaAnual.map((item) => item.toneladas),
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
  }

  if (graficoClima) {
    new Chart(graficoClima, {
      type: "line",
      data: {
        labels: climaMensal.map((item) => item.mes),
        datasets: [
          {
            label: "Temperatura (C)",
            data: climaMensal.map((item) => item.temperatura),
            borderColor: "#c62828",
            backgroundColor: "rgba(198, 40, 40, 0.12)",
            tension: 0.35,
            fill: true,
          },
          {
            label: "Chuva (mm)",
            data: climaMensal.map((item) => item.chuva),
            borderColor: "#1976d2",
            backgroundColor: "rgba(25, 118, 210, 0.10)",
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
      },
    });
  }
}
