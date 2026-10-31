import json
import os

import requests
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
ARQUIVOS_PUBLICOS = {"style.css", "script.js"}

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODELO = "anthropic/claude-haiku-4.5"
PRIORIDADES = {"alta", "media", "baixa"}
MAX_DESCRICAO = 1000
MAX_TAREFAS = 10
MAX_TITULO = 120

app = Flask(__name__)


@app.route("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.route("/<arquivo>")
def arquivo_publico(arquivo):
    # Só entrega os arquivos da whitelist, nunca o app.py ou o .env
    if arquivo not in ARQUIVOS_PUBLICOS:
        abort(404)
    return send_from_directory(PUBLIC_DIR, arquivo)


def montar_prompt(descricao: str) -> str:
    return (
        "Transforme a descrição abaixo em uma lista de tarefas objetivas. "
        f"Gere no máximo {MAX_TAREFAS} tarefas. "
        'Responda SOMENTE com um array JSON no formato '
        '[{"titulo": "...", "prioridade": "alta|media|baixa"}], '
        "sem nenhum texto antes ou depois.\n\n"
        f"Descrição:\n{descricao}"
    )


def extrair_lista_json(texto: str) -> list:
    # A IA às vezes envolve o JSON em texto ou marcadores; pegamos só o trecho da lista
    inicio, fim = texto.find("["), texto.rfind("]")
    if inicio == -1 or fim < inicio:
        raise ValueError("Resposta sem lista JSON")
    dados = json.loads(texto[inicio : fim + 1])
    if not isinstance(dados, list):
        raise ValueError("Resposta não é uma lista")
    return dados


def limpar_tarefas(dados: list) -> list[dict]:
    # Valida cada item antes de devolver ao front-end
    tarefas = []
    for item in dados:
        if not isinstance(item, dict):
            continue
        titulo = str(item.get("titulo", "")).strip()[:MAX_TITULO]
        prioridade = str(item.get("prioridade", "media")).lower()
        if titulo:
            tarefas.append({
                "titulo": titulo,
                "prioridade": prioridade if prioridade in PRIORIDADES else "media",
            })
    return tarefas[:MAX_TAREFAS]


@app.route("/api/ia/gerar-tarefas", methods=["POST"])
def gerar_tarefas():
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        return jsonify({"erro": "Chave da API não configurada no servidor"}), 500

    descricao = str((request.get_json(silent=True) or {}).get("descricao", "")).strip()
    if not descricao or len(descricao) > MAX_DESCRICAO:
        return jsonify({"erro": f"Descreva a tarefa com até {MAX_DESCRICAO} caracteres"}), 400

    try:
        resposta = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODELO,
                "max_tokens": 800,
                "messages": [{"role": "user", "content": montar_prompt(descricao)}],
            },
            timeout=30,
        )
        if not resposta.ok:
            print("ERRO OPENROUTER:", resposta.status_code, resposta.text)
        resposta.raise_for_status()
        texto = resposta.json()["choices"][0]["message"]["content"]
        tarefas = limpar_tarefas(extrair_lista_json(texto))
    except Exception as erro:
        print("ERRO AO GERAR TAREFAS:", repr(erro))
        return jsonify({"erro": "Não foi possível gerar tarefas agora"}), 502

    return jsonify(tarefas), 200


if __name__ == "__main__":
    app.run(debug=True)  # Em produção, desligue o debug