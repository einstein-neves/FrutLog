const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

test("migracao de recuperacao troca segredo e codigos atomicamente e rejeita estado desatualizado", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table usuario(id uuid primary key, status text, senha_hash text,
        totp_secret_ciphertext text, totp_ativado_em timestamptz, totp_ultimo_passo bigint);
      create table desafio_login_otp(id uuid primary key, usuario_id uuid,
        modo text constraint desafio_login_otp_modo_check check(modo in ('setup','login')));
      create table usuario_codigo_recuperacao(usuario_id uuid, codigo_hash text not null
        check(codigo_hash ~ '^[a-f0-9]{64}$'), unique(usuario_id, codigo_hash));
      insert into usuario values ('00000000-0000-0000-0000-000000000001', 'ativo', 'senha', 'antigo', now(), 1);
      insert into usuario_codigo_recuperacao values ('00000000-0000-0000-0000-000000000001', repeat('a',64));
    `);
    await db.exec(readFileSync(require.resolve("../../supabase/032_recuperacao_autenticador.sql"), "utf8"));
    await db.exec(readFileSync(require.resolve("../../supabase/033_login_2fa_email.sql"), "utf8"));
    await db.exec(readFileSync(require.resolve("../../supabase/033_login_2fa_email.sql"), "utf8"));
    const id = "00000000-0000-0000-0000-000000000001";
    await db.query("insert into desafio_login_otp values ($1, $1, 'email')", [id]);
    await db.query("delete from desafio_login_otp where id = $1", [id]);
    await db.query("insert into desafio_login_otp values ($1, $1, 'reset')", [id]);
    const codes = Array.from({ length: 10 }, (_, i) => i.toString(16).padStart(64, "0"));
    const replace = (old, values) => db.query("select substituir_autenticador($1, 'senha', $2, 'novo', 2, $3::text[]) as ok", [id, old, values]);
    assert.equal((await replace("desatualizado", codes)).rows[0].ok, false);
    await assert.rejects(replace("antigo", [...codes.slice(0, 9), "invalido"]));
    assert.equal((await db.query("select totp_secret_ciphertext from usuario")).rows[0].totp_secret_ciphertext, "antigo");
    assert.equal((await db.query("select * from usuario_codigo_recuperacao")).rows.length, 1);
    assert.equal((await db.query("select * from desafio_login_otp")).rows.length, 1);
    assert.equal((await replace("antigo", codes)).rows[0].ok, true);
    assert.equal((await db.query("select totp_secret_ciphertext from usuario")).rows[0].totp_secret_ciphertext, "novo");
    assert.equal((await db.query("select * from usuario_codigo_recuperacao")).rows.length, 10);
    assert.equal((await db.query("select * from desafio_login_otp")).rows.length, 0);
    assert.equal((await replace("antigo", codes)).rows[0].ok, false);
    const permissions = await db.query("select has_function_privilege('anon', 'substituir_autenticador(uuid,text,text,text,bigint,text[])', 'EXECUTE') as anon, has_function_privilege('service_role', 'substituir_autenticador(uuid,text,text,text,bigint,text[])', 'EXECUTE') as service");
    assert.equal(permissions.rows[0].anon, false);
    assert.equal(permissions.rows[0].service, true);
  } finally {
    await db.close();
  }
});
