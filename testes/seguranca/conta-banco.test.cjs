const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
let db;
const org="00000000-0000-4000-8000-000000000001";
const codes=Array.from({length:10},(_,i)=>i.toString(16).padStart(64,"0"));
async function usuario(){const id=crypto.randomUUID();await db.query("insert into usuario(id,status,senha_hash,email,organizacao_id) values($1,'ativo','hash','pessoa@example.com',$2)",[id,org]);return id;}
const scalar=async(sql,args)=>(await db.query(sql,args)).rows[0].ok;
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table organizacao(id uuid primary key);
    insert into organizacao values('${org}');
    create table usuario(id uuid primary key,status text,senha_hash text,email text,organizacao_id uuid,
      totp_secret_ciphertext text,totp_ativado_em timestamptz,totp_ultimo_passo bigint default -1);
    create table desafio_login_otp(id uuid primary key,usuario_id uuid,modo text,codigo_hash text,
      credencial_hash text,totp_secret_ciphertext text,expira_em timestamptz,tentativas integer default 0,criado_em timestamptz default now());
    create table usuario_codigo_recuperacao(id uuid default gen_random_uuid(),usuario_id uuid,codigo_hash text check(codigo_hash ~ '^[a-f0-9]{64}$'),unique(usuario_id,codigo_hash));`);
  for(const file of ["032_recuperacao_autenticador.sql","033_login_2fa_email.sql","034_conta_seguranca_operacao.sql","034_conta_seguranca_operacao.sql"])
    await db.exec(fs.readFileSync(require.resolve(`../../supabase/${file}`),"utf8"));
});
after(async()=>db.close());

test("email exige prova da versao atual e mudanca de endereco remove confirmacao e revoga sessoes",async()=>{
  const id=await usuario();
  assert.equal(await scalar("select conta_confirmar_email($1,'outro@example.com','hash',0) as ok",[id]),false);
  assert.equal(await scalar("select conta_confirmar_email($1,'pessoa@example.com','hash',0) as ok",[id]),true);
  await db.query("update usuario set email='novo@example.com' where id=$1",[id]);
  const u=(await db.query("select * from usuario where id=$1",[id])).rows[0];
  assert.equal(u.email_verificado_em,null);assert.equal(Number(u.sessao_versao),1);
  assert.equal(await scalar("select conta_confirmar_email($1,'pessoa@example.com','hash',0) as ok",[id]),false);
});

test("confirmacoes possuem intervalo, propriedade, limite de tentativas e consumo unico",async()=>{
  const id=await usuario(),outro=await usuario(),desafio=crypto.randomUUID();
  assert.equal(await scalar("select conta_criar_desafio($1,$2,'sessoes',$3,'credencial') as ok",[desafio,id,codes[0]]),true);
  assert.equal(await scalar("select conta_criar_desafio($1,$2,'email',$3,'credencial') as ok",[crypto.randomUUID(),id,codes[0]]),false);
  assert.equal(await scalar("select conta_consumir_desafio($1,$2,$3,'credencial') as ok",[desafio,outro,codes[0]]),null);
  for(let i=0;i<5;i++)assert.equal(await scalar("select conta_consumir_desafio($1,$2,$3,'credencial') as ok",[desafio,id,codes[1]]),null);
  assert.equal(await scalar("select conta_consumir_desafio($1,$2,$3,'credencial') as ok",[desafio,id,codes[0]]),null);
  const novo=crypto.randomUUID();
  assert.equal(await scalar("select conta_criar_desafio($1,$2,'email',$3,'credencial') as ok",[novo,id,codes[0]]),true);
  assert.deepEqual(await scalar("select conta_consumir_desafio($1,$2,$3,'credencial') as ok",[novo,id,codes[0]]),{acao:"email"});
  assert.equal(await scalar("select conta_consumir_desafio($1,$2,$3,'credencial') as ok",[novo,id,codes[0]]),null);
});

test("renovacao atomica exige email confirmado e revoga sessoes; troca de autenticador tambem revoga",async()=>{
  const id=await usuario();
  const renovar=()=>scalar("select conta_renovar_codigos($1,'hash',0,'pessoa@example.com',$2::text[]) as ok",[id,codes]);
  assert.equal(await renovar(),false);
  await db.query("update usuario set email_verificado_em=now() where id=$1",[id]);
  assert.equal(await renovar(),true);
  assert.equal((await db.query("select * from usuario_codigo_recuperacao where usuario_id=$1",[id])).rows.length,10);
  assert.equal(await renovar(),false);
  assert.equal(await scalar("select conta_revogar_sessoes($1,0) as ok",[id]),false);
  assert.equal(await scalar("select conta_revogar_sessoes($1,1) as ok",[id]),true);
  assert.equal(await scalar("select substituir_autenticador($1,'hash',null,'novo',1,$2::text[]) as ok",[id,codes]),true);
  assert.equal(Number((await db.query("select sessao_versao from usuario where id=$1",[id])).rows[0].sessao_versao),3);
});

test("reenvio de login substitui somente desafio valido apos o intervalo",async()=>{
  const id=await usuario(),antes=crypto.randomUUID(),novo=crypto.randomUUID();
  await db.query("insert into desafio_login_otp(id,usuario_id,modo,codigo_hash,credencial_hash,expira_em) values($1,$2,'email',$3,'credencial',now()+interval '5 minutes')",[antes,id,codes[0]]);
  const reenviar=()=>scalar("select login_reservar_reenvio($1,$2,$3,'credencial') as ok",[antes,novo,codes[1]]);
  assert.equal(await reenviar(),false);
  await db.query("update desafio_login_otp set criado_em=now()-interval '61 seconds' where id=$1",[antes]);
  assert.equal(await reenviar(),true);
  assert.equal(await reenviar(),false);
  assert.equal((await db.query("select * from desafio_login_otp where id=$1",[antes])).rows.length,0);
  assert.equal((await db.query("select codigo_hash from desafio_login_otp where id=$1",[novo])).rows[0].codigo_hash,codes[1]);
});

test("configuracao do autenticador recusa email nao confirmado ou versao alterada",async()=>{
  const id=await usuario();
  const configurar=versao=>scalar("select configurar_autenticador_seguro($1,'hash',null,'novo',1,$2::text[],'pessoa@example.com',$3) as ok",[id,codes,versao]);
  assert.equal(await configurar(0),false);
  await db.query("update usuario set email_verificado_em=now() where id=$1",[id]);
  assert.equal(await configurar(1),false);
  assert.equal(await configurar(0),true);
  assert.equal(await configurar(0),false);
});

test("reenvio administrativo aceita apenas boas-vindas com falha e mesma organizacao",async()=>{
  const id=await usuario();
  const e=(await db.query("insert into email_entrega(usuario_id,organizacao_id,tipo,status,atualizado_em) values($1,$2,'boas_vindas','incerto',now()-interval '61 seconds') returning id",[id,org])).rows[0];
  assert.equal(await scalar("select email_reservar_reenvio($1,$2) as ok",[e.id,org]),null);
  await db.query("update email_entrega set status='falhou' where id=$1",[e.id]);
  assert.equal(await scalar("select email_reservar_reenvio($1,$2) as ok",[e.id,crypto.randomUUID()]),null);
  assert.ok(await scalar("select email_reservar_reenvio($1,$2) as ok",[e.id,org]));
  assert.equal(await scalar("select email_reservar_reenvio($1,$2) as ok",[e.id,org]),null);
});

test("novas tabelas e funcoes nao estao acessiveis pelos papeis publicos",async()=>{
  for(const table of ["email_entrega","auditoria_evento","conta_desafio"]){
    const r=await db.query("select has_table_privilege('anon',$1,'SELECT') as ok",[table]);assert.equal(r.rows[0].ok,false);
  }
  assert.equal(await scalar("select has_function_privilege('authenticated','conta_revogar_sessoes(uuid,bigint)','EXECUTE') as ok"),false);
});
