const { test } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const nodemailer = require("nodemailer");
const { criarServicoEmail } = require("../../src/email");

// SMTP local: exerce o transporte real sem enviar mensagens ao Gmail.
async function smtpLocal(t, { interromper = false } = {}) {
  const sockets = new Set();
  const estado = { conexoes: 0, mensagens: 0 };
  const servidor = net.createServer((socket) => {
    estado.conexoes++;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.write("220 localhost SMTP\r\n");
    let buffer = "", dados = false;
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      let fim;
      while ((fim = buffer.indexOf("\r\n")) !== -1) {
        const linha = buffer.slice(0, fim);
        buffer = buffer.slice(fim + 2);
        if (dados) {
          if (linha === ".") {
            dados = false;
            estado.mensagens++;
            socket.write("250 accepted\r\n");
          }
        } else if (/^MAIL FROM:/i.test(linha) && interromper) {
          socket.destroy();
          return;
        } else if (linha === "DATA") {
          dados = true;
          socket.write("354 send message\r\n");
        } else if (linha === "QUIT") {
          socket.end("221 bye\r\n");
        } else {
          socket.write("250 localhost\r\n");
        }
      }
    });
  });
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const servico = criarServicoEmail({
    env: { EMAIL_ENABLED: "true", GMAIL_USER: "projeto@gmail.com", GMAIL_APP_PASSWORD: "abcdefghijklmnop" },
    criarTransporte(opcoes) {
      return nodemailer.createTransport({ ...opcoes, host: "127.0.0.1", port: servidor.address().port,
        secure: false, ignoreTLS: true, auth: undefined });
    },
  });
  t.after(async () => {
    servico.fechar();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => servidor.close(resolve));
  });
  return { servico, estado };
}

const mensagem = { para: "destino@example.com", titulo: "Codigo de teste", mensagem: "Conteudo sintetico" };

test("envios consecutivos reutilizam uma unica conexao SMTP real", { timeout: 10000 }, async (t) => {
  const { servico, estado } = await smtpLocal(t);
  for (let i = 0; i < 3; i++) {
    assert.equal((await servico.enviarNotificacao(mensagem)).sucesso, true);
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(estado.mensagens, 3);
  assert.equal(estado.conexoes, 1);
});

test("queda da conexao nao inicia reenvio automatico de codigo", { timeout: 10000 }, async (t) => {
  const { servico, estado } = await smtpLocal(t, { interromper: true });
  await assert.rejects(servico.enviarNotificacao(mensagem), (erro) => erro.codigo === "EMAIL_UNAVAILABLE");
  assert.equal(estado.conexoes, 1);
  assert.equal(estado.mensagens, 0);
});
