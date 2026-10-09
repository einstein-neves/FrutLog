const crypto = require("crypto");

const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !serviceKey) {
  console.error("Configure SUPABASE_URL e SUPABASE_SECRET_KEY no .env.");
  process.exit(1);
}

function createPasswordHash(password) {
  const rounds = 210000;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, rounds, 32, "sha256").toString("hex");
  return `pbkdf2$${rounds}$${salt}$${hash}`;
}

async function main() {
  const temporaryPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || crypto.randomBytes(7).toString("base64url").slice(0, 10);
  if (temporaryPassword.length < 8 || temporaryPassword.length > 10) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD deve possuir entre 8 e 10 caracteres.");
  }
  const response = await fetch(`${baseUrl}/rest/v1/rpc/provisionar_super_admin_inicial`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      ...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_nome_organizacao: process.env.BOOTSTRAP_ORGANIZATION_NAME || "FrutLog",
      p_nome_fazenda: process.env.BOOTSTRAP_FARM_NAME || "Fazenda Principal",
      p_senha_hash: createPasswordHash(temporaryPassword),
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = result?.message || result?.details || `HTTP ${response.status}`;
    throw new Error(`Nao foi possivel criar o Super Admin: ${reason}`);
  }

  console.log("Super Admin inicial provisionado. Guarde a senha agora; ela nao sera exibida novamente.");
  console.log(`Matricula: ${result.matricula}`);
  console.log(`Senha provisoria: ${temporaryPassword}`);
  console.log("A senha devera ser alterada no primeiro acesso.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
