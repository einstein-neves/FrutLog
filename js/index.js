/* =========================================================
   FRUTLOG - ENTRADA
   Redireciona para o painel do perfil quando ja existe sessao.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const sessao = FrutLog.obterSessao();

  if (sessao?.perfil) {
    FrutLog.redirecionarPorPerfil(sessao.perfil);
  }
});
