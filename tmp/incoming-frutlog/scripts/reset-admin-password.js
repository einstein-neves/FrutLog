const crypto = require("crypto");

const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const newPassword = process.env.ADMIN_RESET_PASSWORD;

if (!baseUrl || !serviceKey) {
  console.error("Configure SUPABASE_URL e SUPABASE_SECRET_KEY no .env.");
  process.exit(1);
}
if (!newPassword || newPassword.length < 8 || newPassword.length > 10) {
  console.error("Defina ADMIN_RESET_PASSWORD no .env com uma senha de 8 a 10 caracteres.");
  process.exit(1);
}

function createPasswordHash(password) {
  const rounds = 210000;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, rounds, 32, "sha256").toString("hex");
  return `pbkdf2$${rounds}$${salt}$${hash}`;
}

async function main() {
  const response = await fetch(`${baseUrl}/rest/v1/usuario?matricula=eq.admin`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      ...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      senha_hash: createPasswordHash(newPassword),
      senha_temporaria: true,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Nao foi possivel redefinir a senha do Admin (HTTP ${response.status}).`);
  }
  if (!Array.isArray(result) || result.length !== 1) {
    throw new Error("Nenhuma conta com matricula admin foi atualizada.");
  }

  console.log("Senha do Admin redefinida. A senha provisoria devera ser alterada no proximo acesso.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
