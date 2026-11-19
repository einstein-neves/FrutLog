const crypto = require("crypto");
const { db } = require("./database");

const PERFIS_VALIDOS = new Set(["engenheiro", "tecnico", "admin"]);

// Cria um token assinado com validade de oito horas.
function versaoCredencial(id, senhaHash, segredo) {
  if (!id || typeof senhaHash !== "string" || !senhaHash) throw new Error("Credencial de sessao ausente.");
  return crypto.createHmac("sha256", segredo)
    .update(JSON.stringify(["frutlog-session-v1", String(id), senhaHash]))
    .digest("hex");
}

function criarToken(usuario, segredo, senhaHash) {
  const cabecalho = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const instante = Math.floor(Date.now() / 1000);
  const conteudo = Buffer.from(JSON.stringify({
    sub: usuario.id,
    matricula: usuario.matricula,
    nome: usuario.nome,
    perfil: usuario.perfil,
    mustChangePassword: Boolean(usuario.mustChangePassword),
    sv: versaoCredencial(usuario.id, senhaHash, segredo),
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
    const partes = String(req.headers.authorization || "")
      .replace(/^Bearer\s+/i, "")
      .split(".");
    if (partes.length !== 3) return null;
    const [cabecalho, conteudo, assinatura] = partes;
    if (!cabecalho || !conteudo || !assinatura) return null;
    if (JSON.parse(Buffer.from(cabecalho, "base64url").toString("utf8")).alg !== "HS256") return null;

    const esperada = crypto.createHmac("sha256", segredo)
      .update(`${cabecalho}.${conteudo}`)
      .digest();
    const recebida = Buffer.from(assinatura, "base64url");
    if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) return null;

    const usuario = JSON.parse(Buffer.from(conteudo, "base64url").toString("utf8"));
    const perfil = usuario.perfil === "administrador" ? "admin" : usuario.perfil;
    return typeof usuario.sub === "string" && usuario.sub.length > 0 &&
      typeof usuario.sv === "string" && /^[a-f0-9]{64}$/.test(usuario.sv) &&
      Number.isFinite(usuario.exp) && usuario.exp > Date.now() / 1000 && PERFIS_VALIDOS.has(perfil)
      ? { ...usuario, perfil, mustChangePassword: Boolean(usuario.mustChangePassword) }
      : null;
  } catch {
    return null;
  }
}

// Consulta o cadastro em TODOS os metodos. O HMAC vincula a sessao ao hash
// atual da senha sem incluir esse hash no token e sem exigir migracao SQL.
async function validarSessao(req, config) {
  const usuario = autenticarRequisicao(req, config.jwt);
  if (!usuario) return null;
  const atual = (await db(config, "usuario", "GET", undefined,
    `?id=eq.${encodeURIComponent(usuario.sub)}&select=id,perfil,status,senha_hash,senha_temporaria,organizacao_id&limit=1`))[0];
  const perfil = atual?.perfil === "administrador" ? "admin" : atual?.perfil;
  if (!atual || String(atual.id) !== usuario.sub || atual.status !== "ativo" ||
    perfil !== usuario.perfil || !atual.senha_hash ||
    Boolean(atual.senha_temporaria) !== usuario.mustChangePassword) return null;
  const esperada = Buffer.from(versaoCredencial(atual.id, atual.senha_hash, config.jwt), "hex");
  const recebida = Buffer.from(usuario.sv, "hex");
  return crypto.timingSafeEqual(esperada, recebida) ? { ...usuario, organizacaoId: atual.organizacao_id } : null;
}

module.exports = { criarToken, autenticarRequisicao, validarSessao };
