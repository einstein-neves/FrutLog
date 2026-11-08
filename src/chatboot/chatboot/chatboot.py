
# ============================================================
# FRUTLOG - CHATBOT COM IA
# Modelo: openai/gpt-oss-20b
# API: Groq
# Base: frutlog_base_compacta_llm.json
# ============================================================

# ------------------------------------------------------------
# 1. INSTALAR BIBLIOTECA (execute no terminal, se necessário)
# ------------------------------------------------------------

# pip install -U groq


# ------------------------------------------------------------
# 2. IMPORTAÇÕES
# ------------------------------------------------------------

import os
import json
import re
import time
import urllib.error
import urllib.request
from getpass import getpass

from groq import Groq


# ------------------------------------------------------------
# 3. CONFIGURAÇÃO DA API
# ------------------------------------------------------------

print("==============================================")
print("       FRUTLOG - CHATBOT COM IA")
print("==============================================")
print()

# NÃO coloque sua API Key diretamente no código.
# O programa vai pedir a chave de forma escondida.

GROQ_API_KEY = getpass("Digite sua GROQ_API_KEY: ")

if not GROQ_API_KEY.strip():
    raise ValueError("A GROQ_API_KEY não foi informada.")

# Cria o cliente da Groq
client = Groq(api_key=GROQ_API_KEY)


# ------------------------------------------------------------
# 4. MODELO
# ------------------------------------------------------------

MODEL = "openai/gpt-oss-20b"
FRUTLOG_API_URL = os.environ.get("FRUTLOG_API_URL", "http://localhost:3000/api").rstrip("/")
FRUTLOG_API_TOKEN = os.environ.get("FRUTLOG_API_TOKEN", "").strip()


# ------------------------------------------------------------
# 5. CARREGAR BASE DE CONHECIMENTO
# ------------------------------------------------------------

ARQUIVO_BASE = "frutlog_base_compacta_llm.json"

try:

    with open(ARQUIVO_BASE, "r", encoding="utf-8") as arquivo:
        base = json.load(arquivo)

except FileNotFoundError:

    print()
    print("ERRO: O arquivo da base não foi encontrado.")
    print()
    print(f"Coloque o arquivo '{ARQUIVO_BASE}' no Colab.")
    raise

except json.JSONDecodeError:

    print()
    print("ERRO: O arquivo JSON está inválido.")
    raise


# Verifica se a estrutura esperada existe
if "conhecimentos" not in base:

    raise ValueError(
        "A base JSON não possui o campo 'conhecimentos'."
    )


conhecimentos = base["conhecimentos"]


print()
print("Base carregada com sucesso.")
print(f"Quantidade de conhecimentos: {len(conhecimentos)}")
print()


# ------------------------------------------------------------
# 6. NORMALIZAÇÃO DE TEXTO
# ------------------------------------------------------------

def normalizar(texto):

    """
    Converte o texto para uma forma mais simples
    para facilitar a busca na base.
    """

    texto = str(texto).lower()

    # Remove acentos
    substituicoes = {
        "á": "a",
        "à": "a",
        "ã": "a",
        "â": "a",
        "ä": "a",

        "é": "e",
        "è": "e",
        "ê": "e",
        "ë": "e",

        "í": "i",
        "ì": "i",
        "î": "i",
        "ï": "i",

        "ó": "o",
        "ò": "o",
        "õ": "o",
        "ô": "o",
        "ö": "o",

        "ú": "u",
        "ù": "u",
        "û": "u",
        "ü": "u",

        "ç": "c"
    }

    for antigo, novo in substituicoes.items():
        texto = texto.replace(antigo, novo)

    # Mantém apenas letras, números e espaços
    texto = re.sub(r"[^a-z0-9\s]", " ", texto)

    # Remove espaços duplicados
    texto = re.sub(r"\s+", " ", texto).strip()

    return texto


# ------------------------------------------------------------
# 7. PALAVRAS QUE NÃO AJUDAM NA BUSCA
# ------------------------------------------------------------

PALAVRAS_IGNORADAS = {
    "o",
    "a",
    "os",
    "as",
    "um",
    "uma",
    "uns",
    "umas",
    "de",
    "do",
    "da",
    "dos",
    "das",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "para",
    "por",
    "com",
    "sem",
    "que",
    "qual",
    "quais",
    "como",
    "onde",
    "quando",
    "e",
    "ou",
    "é",
    "sou",
    "pode",
    "posso",
    "tem",
    "tenho",
    "me",
    "se"
}


# ------------------------------------------------------------
# 8. EXTRAIR PALAVRAS IMPORTANTES
# ------------------------------------------------------------

def palavras_importantes(texto):

    texto = normalizar(texto)

    palavras = texto.split()

    resultado = []

    for palavra in palavras:

        if palavra in PALAVRAS_IGNORADAS:
            continue

        if len(palavra) < 2:
            continue

        resultado.append(palavra)

    return resultado


# ------------------------------------------------------------
# 9. BUSCAR CONHECIMENTOS RELEVANTES
# ------------------------------------------------------------

def buscar_conhecimentos(pergunta, quantidade=5):

    """
    Faz uma busca simples na base JSON.

    A pergunta é comparada com:
    - pergunta cadastrada
    - resposta cadastrada

    Retorna somente os conhecimentos mais relevantes.
    """

    palavras = palavras_importantes(pergunta)

    if not palavras:
        return conhecimentos[:quantidade]

    resultados = []

    for item in conhecimentos:

        pergunta_base = normalizar(item.get("p", ""))
        resposta_base = normalizar(item.get("r", ""))

        texto_base = pergunta_base + " " + resposta_base

        pontuacao = 0

        for palavra in palavras:

            # Palavra aparece na pergunta cadastrada
            if palavra in pergunta_base:
                pontuacao += 3

            # Palavra aparece na resposta
            if palavra in resposta_base:
                pontuacao += 1

        if pontuacao > 0:

            resultados.append(
                {
                    "item": item,
                    "pontuacao": pontuacao
                }
            )

    # Ordena do mais relevante para o menos relevante
    resultados.sort(
        key=lambda x: x["pontuacao"],
        reverse=True
    )

    selecionados = [
        resultado["item"]
        for resultado in resultados[:quantidade]
    ]

    # Se nada foi encontrado, manda alguns registros
    # para o modelo reconhecer que não há informação.
    if not selecionados:
        return conhecimentos[:2]

    return selecionados


# ------------------------------------------------------------
# 10. MONTAR CONTEXTO PARA A IA
# ------------------------------------------------------------

def montar_contexto(itens):

    linhas = []

    for item in itens:

        pergunta = item.get("p", "")
        resposta = item.get("r", "")

        linhas.append(
            f"Pergunta cadastrada: {pergunta}\n"
            f"Resposta cadastrada: {resposta}"
        )

    return "\n\n".join(linhas)


def consultar_contexto_operacional():

    if not FRUTLOG_API_TOKEN:
        return "Contexto operacional indisponivel: configure FRUTLOG_API_TOKEN."

    requisicao = urllib.request.Request(
        f"{FRUTLOG_API_URL}/chatbot/contexto",
        headers={
            "Authorization": f"Bearer {FRUTLOG_API_TOKEN}",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(requisicao, timeout=8) as resposta:
            dados = json.loads(resposta.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as erro:
        raise RuntimeError(f"Falha ao consultar contexto operacional do FrutLog: {erro}") from erro

    ocorrencias = dados.get("ocorrencias")
    sensores = dados.get("sensores")
    if not isinstance(ocorrencias, list) or not isinstance(sensores, list):
        raise RuntimeError("A API do FrutLog retornou contexto operacional invalido.")

    return (
        "Ocorrencias recentes:\n"
        + json.dumps(ocorrencias, ensure_ascii=False)
        + "\nStatus dos sensores:\n"
        + json.dumps(sensores, ensure_ascii=False)
    )


# ------------------------------------------------------------
# 11. INSTRUÇÕES DO CHATBOT
# ------------------------------------------------------------

SYSTEM_PROMPT = """
Você é o assistente virtual oficial do sistema FrutLog.

O FrutLog é um sistema de monitoramento e gestão agrícola
com IoT.

Sua função é responder dúvidas sobre:

- funcionamento do FrutLog;
- Engenheiro;
- Técnico;
- Administrador;
- talhões;
- divisão de talhões;
- sensores;
- cultivos;
- parâmetros;
- status;
- telemetria;
- ThingSpeak;
- inspeções;
- ocorrências;
- problemas de sensores;
- API;
- funcionamento geral do sistema.

REGRAS IMPORTANTES:

1. Responda em português do Brasil.

2. Use somente as informações presentes no CONTEXTO
   fornecido nesta conversa.

3. NÃO invente funcionalidades.

4. NÃO invente endpoints.

5. NÃO invente valores de sensores.

6. NÃO invente permissões de usuários.

7. NÃO invente regras agrícolas.

8. NÃO invente senhas, API keys ou tokens.

9. Se a pergunta não puder ser respondida com o contexto,
   diga claramente:

   "Essa informação ainda não está definida na base de
   conhecimento do FrutLog."

10. Seja direto e fácil de entender.

11. Não diga que você acessou o sistema real se isso não
    aconteceu.

12. Não diga que consultou o banco de dados se isso não
    aconteceu.

13. O sensor mede e envia os dados.
    O FrutLog interpreta os dados conforme os parâmetros
    configurados.

14. A cor roxa no mapa representa seleção visual.
    Não significa status crítico.

15. Os status dos talhões são:
    verde = Normal
    amarelo = Atenção
    vermelho = Crítico.

16. Não exponha credenciais ou informações secretas.
"""


# ------------------------------------------------------------
# 12. HISTÓRICO DA CONVERSA
# ------------------------------------------------------------

historico = []


# ------------------------------------------------------------
# 13. FUNÇÃO PRINCIPAL DE RESPOSTA
# ------------------------------------------------------------

def responder(pergunta):

    """
    Recebe uma pergunta do usuário,
    busca os conhecimentos relevantes
    e consulta o modelo.
    """

    # --------------------------------------------------------
    # Busca somente os conhecimentos relevantes
    # --------------------------------------------------------

    itens_relevantes = buscar_conhecimentos(
        pergunta,
        quantidade=5
    )

    contexto = montar_contexto(itens_relevantes)
    contexto_operacional = consultar_contexto_operacional()


    # --------------------------------------------------------
    # Cria a mensagem do sistema
    # --------------------------------------------------------

    system_message = f"""
{SYSTEM_PROMPT}

CONTEXTO DA BASE DE CONHECIMENTO:

{contexto}

CONTEXTO OPERACIONAL ATUAL DO FRUTLOG:

{contexto_operacional}
"""


    # --------------------------------------------------------
    # Monta histórico reduzido
    # --------------------------------------------------------

    mensagens = [
        {
            "role": "system",
            "content": system_message
        }
    ]


    # Mantém somente as últimas 6 mensagens
    # para evitar crescimento desnecessário do prompt.

    mensagens.extend(historico[-6:])


    # Adiciona a pergunta atual

    mensagens.append(
        {
            "role": "user",
            "content": pergunta
        }
    )


    # --------------------------------------------------------
    # CHAMADA PARA A GROQ
    # --------------------------------------------------------

    try:

        resposta = client.chat.completions.create(

            model=MODEL,

            messages=mensagens,

            # Respostas mais controladas
            temperature=0.2,

            # Evita respostas gigantes
            max_completion_tokens=500,

            # Para o GPT-OSS não precisamos devolver
            # o conteúdo de raciocínio ao chatbot.
            include_reasoning=False
        )


        texto = resposta.choices[0].message.content


        if not texto:
            return "A IA não retornou uma resposta."


        # ----------------------------------------------------
        # Salva conversa
        # ----------------------------------------------------

        historico.append(
            {
                "role": "user",
                "content": pergunta
            }
        )

        historico.append(
            {
                "role": "assistant",
                "content": texto
            }
        )


        return texto.strip()


    # --------------------------------------------------------
    # TRATAMENTO DE ERROS
    # --------------------------------------------------------

    except Exception as erro:

        mensagem_erro = str(erro)

        print()
        print("==============================================")
        print("ERRO NA API")
        print("==============================================")
        print(mensagem_erro)
        print()

        # Erro de autenticação
        if (
            "401" in mensagem_erro
            or "authentication" in mensagem_erro.lower()
            or "api key" in mensagem_erro.lower()
        ):

            return (
                "Erro de autenticação na Groq. "
                "Verifique se a GROQ_API_KEY está correta."
            )


        # Modelo inexistente
        if (
            "404" in mensagem_erro
            or "does not exist" in mensagem_erro.lower()
            or "model" in mensagem_erro.lower()
            and "access" in mensagem_erro.lower()
        ):

            return (
                "O modelo configurado não está disponível "
                "para esta conta."
            )


        # Rate limit
        if (
            "429" in mensagem_erro
            or "rate limit" in mensagem_erro.lower()
        ):

            return (
                "A API atingiu o limite de requisições. "
                "Aguarde alguns segundos e tente novamente."
            )


        # Erro genérico
        return (
            "Ocorreu um erro ao consultar a IA. "
            "Veja a mensagem de erro exibida acima."
        )


# ------------------------------------------------------------
# 14. TESTE AUTOMÁTICO
# ------------------------------------------------------------

print("Testando conexão com o modelo...")
print()

teste = responder(
    "O que é o FrutLog?"
)

print("Resposta do teste:")
print()
print(teste)
print()


# ------------------------------------------------------------
# 15. CHAT INTERATIVO
# ------------------------------------------------------------

print("==============================================")
print("       CHATBOT FRUTLOG INICIADO")
print("==============================================")
print()
print("Digite sua pergunta.")
print("Digite 'sair' para encerrar.")
print()


while True:

    try:

        pergunta = input("Você: ").strip()


        # Não faz nada para entrada vazia

        if not pergunta:
            continue


        # Comando para sair

        if normalizar(pergunta) in {
            "sair",
            "exit",
            "quit",
            "fim"
        }:

            print()
            print("Chatbot encerrado.")
            break


        print()
        print("FrutLog: ", end="")


        resposta = responder(pergunta)


        print(resposta)
        print()


        # Pequena pausa para evitar disparos muito rápidos

        time.sleep(0.3)


    except KeyboardInterrupt:

        print()
        print()
        print("Chatbot encerrado.")
        break


    except Exception as erro:

        print()
        print("Erro inesperado:")
        print(erro)
        print()