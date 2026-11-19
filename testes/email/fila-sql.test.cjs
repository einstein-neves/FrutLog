const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
let db;
const orgA = "00000000-0000-4000-8000-000000000001", orgB = "00000000-0000-4000-8000-000000000002";
const admin = "00000000-0000-4000-8000-000000000011", eng = "00000000-0000-4000-8000-000000000012", tech = "00000000-0000-4000-8000-000000000013";
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table organizacao(id uuid primary key);
    create table usuario(id uuid primary key default gen_random_uuid(), organizacao_id uuid, perfil text, status text default 'ativo', matricula text, senha_hash text, senha_temporaria boolean default false, email varchar(254));
    create table fazenda(id uuid primary key, organizacao_id uuid);
    create table talhao(id uuid primary key, fazenda_id uuid, codigo text);
    create table relatorio_campo_diario(id uuid primary key default gen_random_uuid(), usuario_id uuid, data_relatorio date, status text default 'enviado', conteudo text);
    create table alerta(id uuid primary key default gen_random_uuid(), talhao_id uuid, status text default 'aberto', severidade text default 'media', titulo text, mensagem text);
    insert into organizacao values ('${orgA}'),('${orgB}');
    insert into usuario(id,organizacao_id,perfil,matricula,senha_hash,email) values
      ('${admin}','${orgA}','administrador','A1','HASH-PRIVADO','admin@example.com'),
      ('${eng}','${orgA}','engenheiro','E1','HASH-PRIVADO','eng@example.com'),
      ('${tech}','${orgA}','tecnico','T1','HASH-PRIVADO','tech@example.com'),
      (gen_random_uuid(),'${orgB}','administrador','B1','HASH-PRIVADO','outra-org@example.com');
    insert into fazenda values ('${orgA}','${orgA}');
    insert into talhao values ('${orgA}','${orgA}','T04');`);
  await db.exec(fs.readFileSync(path.join(__dirname, "../../supabase/029_notificacoes_email.sql"), "utf8"));
});
after(async () => db.close());

test("relatorio notifica somente gestores da mesma organizacao; status avisa o autor", async () => {
  await db.exec("delete from email_fila");
  const { rows: [r] } = await db.query(`insert into relatorio_campo_diario(usuario_id,data_relatorio,conteudo) values ($1,'2026-11-17','CONTEUDO-PRIVADO') returning id`, [tech]);
  let { rows } = await db.query("select destinatario,tipo,dados from email_fila order by destinatario");
  assert.deepEqual(rows.map((r) => r.destinatario), ["admin@example.com", "eng@example.com"]);
  assert.ok(rows.every((r) => r.tipo === "relatorio_enviado"));
  assert.ok(!JSON.stringify(rows).includes("CONTEUDO-PRIVADO"));
  await db.query("update relatorio_campo_diario set conteudo='Edicao sem mudar status' where id=$1", [r.id]);
  assert.equal((await db.query("select * from email_fila")).rows.length, 2);
  await db.query("update relatorio_campo_diario set status='concluido' where id=$1", [r.id]);
  rows = (await db.query("select * from email_fila where tipo='relatorio_status'")).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].destinatario, "tech@example.com");
});

test("alerta avisa abertura e resolucao; atualizacao da leitura nao gera spam", async () => {
  await db.exec("delete from email_fila");
  const { rows: [r] } = await db.query(`insert into alerta(talhao_id,titulo,mensagem) values ($1,'Calor','leitura original') returning id`, [orgA]);
  assert.equal((await db.query("select * from email_fila")).rows.length, 3);
  await db.query("update alerta set mensagem='nova leitura' where id=$1", [r.id]);
  assert.equal((await db.query("select * from email_fila")).rows.length, 3);
  await db.query("update alerta set status='resolvido' where id=$1", [r.id]);
  const { rows } = await db.query("select * from email_fila where tipo='alerta_resolvido'");
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.organizacao_id === orgA));
});

test("conta e reset registram apenas aviso pessoal, nunca senha ou hash", async () => {
  await db.exec("delete from email_fila");
  const { rows: [u] } = await db.query(`insert into usuario(organizacao_id,perfil,matricula,senha_hash,email) values ($1,'tecnico','T2','HASH-SECRETO','novo@example.com') returning id`, [orgA]);
  await db.query("update usuario set senha_hash='OUTRO-HASH-SECRETO',senha_temporaria=true where id=$1", [u.id]);
  await db.query("update usuario set senha_hash='HASH-FINAL-SECRETO',senha_temporaria=false where id=$1", [u.id]);
  const { rows } = await db.query("select * from email_fila order by criado_em,id");
  assert.deepEqual(rows.map((r) => r.tipo).sort(), ["conta_criada", "senha_alterada", "senha_redefinida"]);
  assert.ok(rows.every((r) => r.usuario_id === u.id && r.destinatario === "novo@example.com"));
  assert.ok(!JSON.stringify(rows).includes("SECRETO"));
  await db.query("update usuario set email=null where id=$1", [u.id]);
});

test("sem email ou conta inativa nao recebe; rollback desfaz o evento junto com a operacao", async () => {
  await db.exec("delete from email_fila");
  await db.query("insert into usuario(organizacao_id,perfil,matricula,senha_hash) values ($1,'tecnico','T3','HASH')", [orgA]);
  await db.query("insert into usuario(organizacao_id,perfil,matricula,senha_hash,email,status) values ($1,'tecnico','T4','HASH','inativo@example.com','inativo')", [orgA]);
  assert.equal((await db.query("select * from email_fila")).rows.length, 0);
  await db.exec(`begin; insert into alerta(talhao_id,titulo) values ('${orgA}','Nao persistido'); rollback;`);
  assert.equal((await db.query("select * from email_fila")).rows.length, 0);
});

test("reservas distintas, confirmacao protegida por token e reserva expirada nao reenvia", async () => {
  await db.exec("delete from email_fila");
  await db.query("insert into alerta(talhao_id,titulo) values ($1,'Nova ocorrencia')", [orgA]);
  const a = (await db.query("select * from email_reservar()" )).rows[0];
  const b = (await db.query("select * from email_reservar()" )).rows[0];
  assert.notEqual(a.id, b.id);
  assert.equal((await db.query("select email_finalizar($1,$2,'enviado',null) as ok", [a.id, b.reserva])).rows[0].ok, false);
  assert.equal((await db.query("select email_finalizar($1,$2,'enviado',null) as ok", [a.id, a.reserva])).rows[0].ok, true);
  await db.query("update email_fila set reservado_em=now()-interval '6 minutes' where id=$1", [b.id]);
  await db.query("select * from email_reservar()");
  assert.equal((await db.query("select status from email_fila where id=$1", [b.id])).rows[0].status, "incerto");
});

test("fila e funcoes privilegiadas nao ficam disponiveis a anon ou authenticated", async () => {
  const { rows: [r] } = await db.query(`select
    has_table_privilege('anon','email_fila','select') as leitura,
    has_function_privilege('anon','email_reservar()','execute') as reserva,
    has_function_privilege('authenticated','email_finalizar(uuid,uuid,text,text)','execute') as confirma,
    has_function_privilege('service_role','email_reservar()','execute') as worker`);
  assert.deepEqual(r, { leitura: false, reserva: false, confirma: false, worker: true });
});
