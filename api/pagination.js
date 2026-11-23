function paginacao(url, padrao = 50) {
  const page = url.searchParams.get("pagina") || "1";
  const size = url.searchParams.get("limite") || String(padrao);
  if (!/^\d+$/.test(page) || !/^\d+$/.test(size) || Number(page) < 1 || Number(page) > 100000 || Number(size) < 1 || Number(size) > 100) {
    const error = new Error("Pagina ou limite invalido (1 a 100 itens)."); error.status = 400; throw error;
  }
  return { pagina: Number(page), limite: Number(size), offset: (Number(page) - 1) * Number(size) };
}
module.exports = { paginacao };
