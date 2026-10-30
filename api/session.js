const crypto = require("crypto");

const PERFIS_VALIDOS = new Set(["engenheiro", "tecnico", "admin"]);

// Cria um token assinado com validade de oito horas.
function criarToken(usuario, segredo) {
  const cabecalho = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const instante = Math.floor(Date.now() / 1000);
  const conteudo = Buffer.from(JSON.stringify({
    sub: usuario.id,
    matricula: usuario.matricula,
    nome: usuario.nome,
    perfil: usuario.perfil,
    mustChangePassword: Boolean(usuario.mustChangePassword),
    iat: instante,
    exp: instante + 28800,
  })).toString("base64url");
  const assinatura = crypto.createHmac("sha256", segredo)
    .update(`${cabecalho}.${conteudo}`)
    .digest("base64url");
  return `${cabecalho}.${conteudo}.${assinatura}`;
}

// Confere assinatura, validade e perfil antes de expor os dados da sessão.
function autenticarRequisicao(req, segredo) {
  try {
    const [cabecalho, conteudo, assinatura] = String(req.headers.authorization || "")
      .replace(/^Bearer\s+/i, "")
      .split(".");
    if (!cabecalho || !conteudo || !assinatura) return null;

    const esperada = crypto.createHmac("sha256", segredo)
      .update(`${cabecalho}.${conteudo}`)
      .digest();
    const recebida = Buffer.from(assinatura, "base64url");
    if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) return null;

    const usuario = JSON.parse(Buffer.from(conteudo, "base64url").toString("utf8"));
    const perfil = usuario.perfil === "administrador" ? "admin" : usuario.perfil;
    return usuario.exp > Date.now() / 1000 && PERFIS_VALIDOS.has(perfil)
      ? { ...usuario, perfil, mustChangePassword: Boolean(usuario.mustChangePassword) }
      : null;
  } catch {
    return null;
  }
}

module.exports = { criarToken, autenticarRequisicao };
