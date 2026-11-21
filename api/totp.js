const crypto = require("crypto");

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(input) {
  const bytes = Buffer.from(input);
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(secret) {
  let bits = 0, value = 0;
  const out = [];
  for (const char of String(secret).toUpperCase().replace(/=+$/g, "").replace(/\s/g, "")) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Segredo TOTP inválido.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function criarSegredo() {
  return base32Encode(crypto.randomBytes(20));
}

function codigoNoPasso(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(number).padStart(6, "0");
}

function verificarCodigo(secret, code, now = Date.now(), lastStep = -1) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1]) {
    if (step <= Number(lastStep)) continue;
    const expected = Buffer.from(codigoNoPasso(secret, step));
    const received = Buffer.from(code);
    if (expected.length === received.length && crypto.timingSafeEqual(expected, received)) return step;
  }
  return null;
}

function criptografarSegredo(secret, jwtSecret) {
  const key = Buffer.from(crypto.hkdfSync("sha256", Buffer.from(jwtSecret), Buffer.from("frutlog-otp"), Buffer.from("totp-secret-encryption-v1"), 32));
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function descriptografarSegredo(value, jwtSecret) {
  const [version, rawNonce, rawTag, rawCipher] = String(value || "").split(".");
  if (version !== "v1" || !rawNonce || !rawTag || !rawCipher) throw new Error("Segredo TOTP inválido.");
  const key = Buffer.from(crypto.hkdfSync("sha256", Buffer.from(jwtSecret), Buffer.from("frutlog-otp"), Buffer.from("totp-secret-encryption-v1"), 32));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(rawNonce, "base64url"));
  decipher.setAuthTag(Buffer.from(rawTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(rawCipher, "base64url")), decipher.final()]).toString("utf8");
}

function uri(secret, account) {
  const label = encodeURIComponent(`FrutLog:${account}`);
  const query = new URLSearchParams({ secret, issuer: "FrutLog", algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${query}`;
}

function criarCodigosRecuperacao(quantidade = 10) {
  return Array.from({ length: quantidade }, () => {
    const raw = base32Encode(crypto.randomBytes(8)).slice(0, 12);
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

function hashCodigoRecuperacao(userId, code, jwtSecret) {
  const normalizado = String(code || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (!/^[A-Z2-7]{12}$/.test(normalizado)) return null;
  return crypto.createHmac("sha256", jwtSecret).update(`frutlog-recovery-v1:${userId}:${normalizado}`).digest("hex");
}

module.exports = {
  base32Encode, base32Decode, criarSegredo, codigoNoPasso, verificarCodigo,
  criptografarSegredo, descriptografarSegredo, uri, criarCodigosRecuperacao, hashCodigoRecuperacao,
};
