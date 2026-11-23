/* =========================================================================
   FrutLog - CONFERIDOR DE ESQUEMA: o que o codigo pede x o que o banco tem
   =========================================================================

   POR QUE ESTE SCRIPT EXISTE
   --------------------------
   O repositorio e o banco publicado divergiram, e so se descobre em
   producao. Exemplos reais ja encontrados neste projeto:

     supabase/schema.sql diz       o banco publicado tem
     ---------------------------------------------------
     usuario.nome                  usuario.nome_completo
     regra_alerta.valor_maximo     regra_alerta.limite
     on delete set null            bloqueia a exclusao

   Nenhum desses erros aparece ao escrever o codigo. Nao ha aviso do editor,
   nao ha erro de sintaxe, o `node --check` passa. Eles aparecem quando o
   usuario clica no botao e o PostgREST devolve 400 ou 42703 na cara dele.

   A migration 027 ataca o mesmo problema pelo outro lado: ela CORRIGE o que
   ja quebrou. Este script AVISA antes, e nao escreve nada.

   COMO ELE SABE O QUE O BANCO TEM
   -------------------------------
   O PostgREST publica o proprio esquema em formato OpenAPI na raiz da API.
   Isso vale ate para tabela vazia -- diferente de `select *`, que em tabela
   sem linha nenhuma nao revela coluna alguma.

   COMO ELE SABE O QUE O CODIGO PEDE
   ---------------------------------
   Lendo os arquivos e extraindo os nomes de coluna que aparecem em:
     - api/[...route].js      ->  db(c, "tabela", ..., "?select=a,b&c=eq.1")
     - os .js dentro de src/  ->  .from("tabela").select("a, b").eq("c", 1)

   (nao escreva o caminho com curinga aqui: a sequencia asterisco-barra
   fecharia este comentario no meio e o texto viraria codigo)

   E uma leitura por texto, nao uma analise de verdade do programa. Entao
   ela pode errar para menos (deixar passar coluna montada em variavel),
   mas o que ela acusa vale a pena olhar. Falso positivo conhecido: nome de
   coluna que tambem e palavra reservada do PostgREST (limit, offset...).

   COMO RODAR
   ----------
     npm run conferir-esquema

   Sai com codigo 1 se achar divergencia, para poder entrar em CI um dia.
   ========================================================================= */

const fs = require("fs");
const path = require("path");

const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !serviceKey) {
  console.error("Configure SUPABASE_URL e SUPABASE_SECRET_KEY no .env.");
  process.exit(1);
}

const RAIZ = path.join(__dirname, "..");

// Palavras que aparecem onde um nome de coluna apareceria, mas sao sintaxe do
// PostgREST. Sem esta lista o relatorio enche de alarme falso.
const NAO_SAO_COLUNAS = new Set([
  "select", "order", "limit", "offset", "and", "or", "not", "on_conflict",
  "columns", "count", "asc", "desc", "nullsfirst", "nullslast",
]);

// -------------------------------------------------------------------------
// 1. O QUE O BANCO TEM
// -------------------------------------------------------------------------
async function lerEsquemaDoBanco() {
  const resposta = await fetch(`${baseUrl}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!resposta.ok) {
    throw new Error(`O Supabase respondeu HTTP ${resposta.status} ao pedir o esquema.`);
  }

  const corpo = await resposta.json();

  const tabelas = new Map();
  for (const [nome, definicao] of Object.entries(corpo.definitions || {})) {
    tabelas.set(nome, new Set(Object.keys(definicao.properties || {})));
  }

  // Funcoes do banco (RPC) nao sao tabelas: o OpenAPI as publica em `paths`,
  // como /rpc/<nome>, e nao em `definitions`. Sem separar as duas coisas, toda
  // chamada de RPC viraria "tabela que nao existe" no relatorio.
  const funcoes = new Set();
  for (const caminho of Object.keys(corpo.paths || {})) {
    if (caminho.startsWith("/rpc/")) funcoes.add(caminho.slice(5));
  }

  return { tabelas, funcoes };
}

// -------------------------------------------------------------------------
// 2. O QUE O CODIGO PEDE
// -------------------------------------------------------------------------

/** Junta colunas numa tabela do mapa, criando a entrada se for a primeira. */
function anotar(mapa, tabela, colunas, arquivo) {
  if (!tabela) return;
  const registro = mapa.get(tabela) || { colunas: new Map() };
  for (const coluna of colunas) {
    const limpa = String(coluna).trim();
    if (!limpa || NAO_SAO_COLUNAS.has(limpa.toLowerCase())) continue;
    // Guarda em qual arquivo apareceu, para o relatorio dizer onde olhar.
    if (!registro.colunas.has(limpa)) registro.colunas.set(limpa, new Set());
    registro.colunas.get(limpa).add(arquivo);
  }
  mapa.set(tabela, registro);
}

/** Extrai os nomes de coluna de uma query string do PostgREST. */
function colunasDaQuery(query) {
  const achadas = [];

  // select=a,b,c  (ignora o embed "tabela(...)", que nao e coluna simples)
  const select = query.match(/select=([^&]+)/);
  if (select) {
    for (const parte of select[1].split(",")) {
      const campo = parte.split("(")[0].split(":").pop().trim();
      if (campo && campo !== "*") achadas.push(campo);
    }
  }

  // order=coluna.desc
  for (const m of query.matchAll(/order=([^&]+)/g)) {
    for (const parte of m[1].split(",")) achadas.push(parte.split(".")[0].trim());
  }

  // filtros: coluna=eq.valor, coluna=in.(...), coluna=is.null
  for (const m of query.matchAll(/[?&]([a-z_][a-z0-9_]*)=(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd)\./gi)) {
    achadas.push(m[1]);
  }

  return achadas;
}

/** Le api/[...route].js, que fala com o banco pelo helper db(). */
function lerChamadasDaApi(mapa) {
  const arquivo = "api/[...route].js";
  const texto = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");

  // db(c, "tabela", "GET", undefined, `?select=...`)
  // O nome da tabela as vezes vem com filtro grudado: "dispositivo?id=eq.x"
  for (const m of texto.matchAll(/\bdb\(\s*c\s*,\s*[`"']([^`"']+)[`"']\s*,\s*[`"'](GET|POST|PATCH|DELETE)[`"']([\s\S]{0,400}?)\)/g)) {
    const [, alvo, , resto] = m;
    const tabela = alvo.split("?")[0];
    const colunas = [];

    if (alvo.includes("?")) colunas.push(...colunasDaQuery("?" + alvo.split("?")[1]));

    // A query do 5o argumento, quando existe.
    const query = resto.match(/[`"'](\?[^`"']*)[`"']/);
    if (query) colunas.push(...colunasDaQuery(query[1]));

    // Corpo de POST/PATCH: as chaves do objeto literal sao colunas.
    const corpo = resto.match(/\{([\s\S]*?)\}/);
    if (corpo) {
      for (const chave of corpo[1].matchAll(/(?:^|[,{\s])([a-z_][a-z0-9_]*)\s*:/g)) colunas.push(chave[1]);
    }

    anotar(mapa, tabela, colunas, arquivo);
  }

  // Tabela escolhida em tempo de execucao, pelo padrao usado na rota
  // PATCH /admin/historico-operacao/:tipo/:id:
  //
  //   const recursos = {
  //     talhao:  { tabela: "talhao",        colunas: "id,arquivado_em" },
  //     ciclo:   { tabela: "ciclo_cultura", colunas: "id,talhao_id,status,..." },
  //   };
  //   const { tabela: resource, colunas } = recursos[type];
  //
  // O `db(c, resource, ...)` nao diz qual tabela e -- so se sabe rodando. Mas
  // o par tabela/colunas esta escrito ali em cima, literal, e pode ser lido.
  //
  // Fechar esta brecha importa mais que as outras: foi exatamente aqui que
  // nasceu o bug que a migration 027 documenta, quando as tres tabelas
  // recebiam a mesma lista de colunas e "Arquivar colheita" quebrava porque
  // colheita nao tem `status`.
  for (const m of texto.matchAll(/tabela:\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*,\s*colunas:\s*["'`]([^"'`]+)["'`]/g)) {
    anotar(mapa, m[1], m[2].split(","), arquivo);
  }
}

/** Le os arquivos que usam supabase-js (.from().select()). */
function lerChamadasDoSrc(mapa) {
  const arquivos = [];
  (function varrer(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, item.name);
      if (item.isDirectory()) varrer(completo);
      else if (item.name.endsWith(".js")) arquivos.push(completo);
    }
  })(path.join(RAIZ, "src"));

  for (const completo of arquivos) {
    const relativo = path.relative(RAIZ, completo).replace(/\\/g, "/");
    const texto = fs.readFileSync(completo, "utf8");

    // .from("tabela") seguido do encadeamento que pertence a ELA.
    //
    // O `?` depois de .from garante que a janela pare no proximo .from(, e
    // nao no proximo ponto-e-virgula. Sem isso, varias consultas dentro do
    // mesmo Promise.all viram uma so: a primeira versao deste script acusou
    // "regra_alerta.status" porque atravessou para a consulta de
    // ciclo_cultura, que vinha logo abaixo e ainda antes do `;`.
    for (const m of texto.matchAll(/\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*\)((?:(?!\.from\()[\s\S]){0,500}?)(?:;|\.from\()/g)) {
      const [, tabela, encadeado] = m;
      const colunas = [];

      const select = encadeado.match(/\.select\(\s*["'`]([^"'`]*)["'`]/);
      if (select && select[1].trim() !== "*") {
        for (const parte of select[1].split(",")) {
          const campo = parte.split("(")[0].trim();
          if (campo) colunas.push(campo);
        }
      }

      for (const f of encadeado.matchAll(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|not|order)\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/g)) {
        colunas.push(f[2]);
      }

      anotar(mapa, tabela, colunas, relativo);
    }
  }
}

// -------------------------------------------------------------------------
// 3. COMPARAR E RELATAR
// -------------------------------------------------------------------------
(async () => {
  console.log("FrutLog - conferindo o codigo contra o banco publicado\n");

  const { tabelas: banco, funcoes } = await lerEsquemaDoBanco();
  console.log(`  banco:  ${banco.size} tabelas/views e ${funcoes.size} funcoes (RPC)`);

  const pedidas = new Map();
  lerChamadasDaApi(pedidas);
  lerChamadasDoSrc(pedidas);
  console.log(`  codigo: ${pedidas.size} alvos referenciados\n`);

  const tabelasInexistentes = [];
  const funcoesInexistentes = [];
  const colunasInexistentes = [];
  const naoConferiveis = [];

  for (const [tabela, registro] of [...pedidas].sort()) {
    // Alvo montado em variavel (`${resource}`): o nome so existe em tempo de
    // execucao, entao leitura por texto nao tem o que conferir. Vale avisar
    // em vez de calar: e justamente onde um erro passaria despercebido.
    if (tabela.includes("${") || tabela.includes("+")) {
      naoConferiveis.push(tabela);
      continue;
    }

    // Chamada de funcao do banco: confere contra a lista de RPC, nao de tabela.
    if (tabela.startsWith("rpc/")) {
      const nome = tabela.slice(4);
      if (!funcoes.has(nome)) funcoesInexistentes.push(nome);
      continue;
    }

    const doBanco = banco.get(tabela);
    if (!doBanco) {
      tabelasInexistentes.push(tabela);
      continue;
    }
    for (const [coluna, arquivos] of registro.colunas) {
      if (!doBanco.has(coluna)) {
        colunasInexistentes.push({ tabela, coluna, arquivos: [...arquivos] });
      }
    }
  }

  if (tabelasInexistentes.length) {
    console.log("TABELAS QUE O CODIGO USA E O BANCO NAO TEM");
    for (const t of tabelasInexistentes) console.log(`  ${t}`);
    console.log("");
  }

  if (funcoesInexistentes.length) {
    console.log("FUNCOES (RPC) QUE O CODIGO CHAMA E O BANCO NAO TEM");
    for (const f of funcoesInexistentes) console.log(`  ${f}()`);
    console.log("");
  }

  if (colunasInexistentes.length) {
    console.log("COLUNAS QUE O CODIGO PEDE E O BANCO NAO TEM");
    for (const d of colunasInexistentes) {
      console.log(`  ${d.tabela}.${d.coluna}`);
      console.log(`      usada em: ${d.arquivos.join(", ")}`);
      const parecidas = [...(banco.get(d.tabela) || [])]
        .filter((c) => c.includes(d.coluna) || d.coluna.includes(c) || c.slice(0, 4) === d.coluna.slice(0, 4));
      if (parecidas.length) console.log(`      no banco existe: ${parecidas.join(", ")}`);
    }
    console.log("");
  }

  if (naoConferiveis.length) {
    console.log("NAO CONFERIVEL POR LEITURA DE TEXTO (nome da tabela vem de variavel)");
    for (const t of naoConferiveis) console.log(`  ${t}`);
    console.log("  Nao e erro -- e ponto cego. Se houver bug de esquema, mora aqui.\n");
  }

  const total = tabelasInexistentes.length + funcoesInexistentes.length + colunasInexistentes.length;
  if (!total) {
    console.log("Nenhuma divergencia encontrada entre o codigo e o banco.");
    return;
  }

  console.log(`${total} divergencia(s). Cada uma e um erro que so apareceria em producao.`);
  console.log("Confira se e erro de digitacao no codigo ou coluna faltando no banco");
  console.log("antes de escrever migration: as duas causas dao a mesma mensagem.");
  process.exitCode = 1;
})().catch((erro) => {
  console.error("Falha ao conferir o esquema:", erro.message);
  process.exitCode = 1;
});
