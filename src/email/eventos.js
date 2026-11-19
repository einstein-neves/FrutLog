function criarMensagemEvento(evento, perfil, baseUrl) {
  const dados = evento.dados || {};
  const tipos = {
    conta_criada: ["Sua conta FrutLog foi criada", "Bem-vindo ao FrutLog", "Seu acesso foi cadastrado. Solicite a senha provisória à Administração por um canal seguro e altere-a no primeiro acesso.", "informacao"],
    email_cadastrado: ["Seu e-mail foi cadastrado no FrutLog", "Cadastro de contato", "Este endereço foi associado à sua conta para receber notificações. Se você não reconhece o cadastro, entre em contato com a Administração.", "informacao"],
    senha_redefinida: ["Sua senha foi redefinida", "Segurança da conta", "A Administração redefiniu sua senha e as sessões anteriores foram revogadas. Solicite a senha provisória por um canal seguro e altere-a no próximo acesso.", "atencao"],
    senha_alterada: ["Sua senha foi alterada", "Segurança da conta", "A senha da sua conta foi atualizada. As sessões anteriores foram revogadas. Se você não realizou esta ação, procure a Administração imediatamente.", "informacao"],
    relatorio_enviado: ["Novo relatório de campo disponível", "Relatórios de campo", "Um relatório diário foi registrado e está disponível para acompanhamento pela Administração e Engenharia.", "informacao"],
    relatorio_status: [dados.status === "concluido" ? "Seu relatório foi concluído" : dados.status === "em_analise" ? "Seu relatório está em análise" : "Seu relatório foi atualizado", "Acompanhamento do relatório", dados.status === "concluido" ? "O acompanhamento do seu relatório diário foi concluído. Consulte o histórico no FrutLog." : "O status do seu relatório diário foi atualizado. Consulte o acompanhamento no FrutLog.", "sucesso"],
    alerta_aberto: ["Um talhão precisa de atenção", "Alerta de campo", "Um novo alerta foi registrado. Consulte os dados atuais no FrutLog e siga a orientação da Engenharia responsável.", ["alta", "critica"].includes(dados.severidade) ? "critico" : "atencao"],
    alerta_resolvido: ["Um alerta de campo foi resolvido", "Atualização do campo", "O alerta foi marcado como resolvido no sistema. Consulte o histórico para acompanhar a ocorrência.", "sucesso"],
  };
  const item = tipos[evento.tipo];
  if (!item) throw new Error("Tipo de notificacao desconhecido.");
  const detalhes = [];
  if (dados.matricula) detalhes.push(["Matrícula", String(dados.matricula).slice(0, 80)]);
  if (dados.talhao) detalhes.push(["Talhão", String(dados.talhao).slice(0, 80)]);
  if (dados.titulo) detalhes.push(["Ocorrência", String(dados.titulo).slice(0, 255)]);
  if (dados.data) detalhes.push(["Data do relatório", String(dados.data).split("-").reverse().join("/")]);
  if (dados.severidade) detalhes.push(["Prioridade", ({ alta: "Alta", critica: "Crítica", media: "Média", baixa: "Baixa" })[dados.severidade] || "Consultar no sistema"]);
  if (evento.criado_em && Number.isFinite(Date.parse(evento.criado_em))) detalhes.push(["Registrado em", new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(new Date(evento.criado_em))]);
  const pagina = ({ admin: "admin.html", administrador: "admin.html", engenheiro: "eng.html", tecnico: "tec.html" })[perfil];
  if (!pagina) throw new Error("Perfil de destinatario invalido.");
  let acaoUrl;
  if (baseUrl) {
    const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("EMAIL_APP_URL deve ser a URL HTTPS publica do FrutLog, sem credenciais, consulta ou fragmento.");
    const pessoal = ["conta_criada", "email_cadastrado", "senha_redefinida", "senha_alterada"].includes(evento.tipo);
    acaoUrl = new URL(pessoal ? "login.html" : pagina, base).href;
  }
  return { titulo: item[0], categoria: item[1], mensagem: item[2], nivel: item[3], detalhes, acaoUrl };
}
module.exports = { criarMensagemEvento };
