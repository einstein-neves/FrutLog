const crypto = require("node:crypto");
const { promisify } = require("node:util");
const pbkdf2 = promisify(crypto.pbkdf2);

function senhaValida(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}
async function hashPassword(password) {
  if (!senhaValida(password)) throw new Error("A senha deve ter de 8 a 128 caracteres.");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await pbkdf2(password, salt, 210000, 32, "sha256");
  return `pbkdf2$210000$${salt}$${hash.toString("hex")}`;
}
async function passwordOk(password, stored) {
  const [kind, rounds, salt, hash] = String(stored || "").split("$");
  if (!senhaValida(password) || kind !== "pbkdf2" || !/^\d+$/.test(rounds) || Number(rounds) < 10000 || Number(rounds) > 1000000 || !salt || !/^[a-f0-9]{64}$/i.test(hash)) return false;
  const actual = await pbkdf2(password, salt, Number(rounds), 32, "sha256");
  return crypto.timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
module.exports = { senhaValida, hashPassword, passwordOk };
