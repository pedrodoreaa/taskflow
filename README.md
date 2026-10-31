# TaskFlow

Gerenciador de tarefas web com geração de tarefas por IA. O front-end é feito com HTML, CSS e JavaScript, e o back-end com Python (Flask), que integra um modelo de IA via API do OpenRouter.

## Funcionalidades

- Criar, editar, concluir e excluir tarefas
- Busca e filtros (todas, pendentes, concluídas)
- Dados salvos no navegador com `localStorage`
- Geração de tarefas com IA: descreva o que precisa fazer e escolha quais sugestões salvar, cada uma com prioridade

## Tecnologias

- **Front-end:** HTML5, CSS3, JavaScript (DOM, eventos, `fetch`, `localStorage`)
- **Back-end:** Python, Flask, Requests, python-dotenv
- **IA:** modelo Claude acessado pela API do OpenRouter

## Como rodar

1. Clone o repositório e entre na pasta:

   ```bash
   git clone https://github.com/pedrodoreaa/taskflow.git
   cd taskflow
   ```

2. Instale as dependências:

   ```bash
   pip install flask requests python-dotenv
   ```

3. Crie um arquivo `.env` na pasta `taskflow` com a sua chave:

   ```
   OPENROUTER_API_KEY=sua-chave-aqui
   ```

   A chave pode ser criada em [openrouter.ai](https://openrouter.ai). Ela fica só no servidor e nunca deve ser colocada no código.

4. Rode o servidor:

   ```bash
   python app.py
   ```

5. Abra `http://127.0.0.1:5000` no navegador.

## Estrutura

```
taskflow/
├── app.py            # servidor Flask e integração com a IA
├── .gitignore        # ignora o .env
└── public/
    ├── index.html    # interface
    ├── script.js     # lógica do front-end e chamadas à API
    └── style.css     # estilos
```

## Segurança

- A chave da API fica em variável de ambiente (`.env`), que está no `.gitignore`.
- O navegador nunca recebe a chave: ele chama apenas `/api/ia/gerar-tarefas`.
- A resposta da IA é validada antes de ser usada: só itens com título e prioridade válida são aceitos, e os textos são limitados em tamanho.
- Todo conteúdo digitado pelo usuário é exibido com `textContent`, evitando injeção de HTML.

## Limitações

- As tarefas ficam salvas só no navegador. Não há banco de dados nem contas de usuário.
- Projeto de estudo, não preparado para produção (o modo debug do Flask está ligado).

## Próximos passos

- Banco de dados (SQLite) para salvar tarefas no servidor
- Autenticação de usuários
- Automação com n8n para enviar o resumo das tarefas geradas
