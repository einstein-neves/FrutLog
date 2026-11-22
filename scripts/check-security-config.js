const required = [
  ["SUPABASE_URL", process.env.SUPABASE_URL],
  ["SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY],
  ["JWT_SECRET", process.env.JWT_SECRET],
  ["IOT_API_KEY", process.env.IOT_API_KEY],
  ["FRONTEND_ORIGIN", process.env.FRONTEND_ORIGIN],
  ["TOTP_ENCRYPTION_KEY", process.env.TOTP_ENCRYPTION_KEY],
  ["SECURITY_MISSION_CODE", process.env.SECURITY_MISSION_CODE],
];
const missing = required.filter(([, value]) => !value?.trim()).map(([name]) => name);
const invalid = [];
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) invalid.push("JWT_SECRET (minimo 32 caracteres)");
if (process.env.TOTP_ENCRYPTION_KEY && Buffer.byteLength(process.env.TOTP_ENCRYPTION_KEY, "utf8") < 32) invalid.push("TOTP_ENCRYPTION_KEY (minimo 32 bytes)");
if (process.env.SECURITY_MISSION_CODE && !/^[A-Za-z0-9]{6}$/.test(process.env.SECURITY_MISSION_CODE)) invalid.push("SECURITY_MISSION_CODE (deve conter exatamente seis caracteres alfanumericos)");
if (process.env.SUPABASE_URL) {
  try { new URL(process.env.SUPABASE_URL); } catch { invalid.push("SUPABASE_URL (formato invalido)"); }
}
if (missing.length || invalid.length) {
  if (missing.length) console.error(`Variaveis ausentes: ${missing.join(", ")}`);
  if (invalid.length) console.error(`Formato invalido: ${invalid.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Configuracao de seguranca presente; valores nao exibidos.");
}
