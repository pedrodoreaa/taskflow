const STORAGE_KEY = "taskflow:tarefas";
const IA_ENDPOINT = "/api/ia/gerar-tarefas";
const TAMANHO_MAX_TITULO = 120;
const PRIORIDADES = ["alta", "media", "baixa"];

const EXEMPLOS = [
  { id: 1, title: "Estudar JavaScript", completed: false, priority: "alta" },
  { id: 2, title: "Revisar o código do TaskFlow", completed: false, priority: "media" },
  { id: 3, title: "Organizar o portfólio no GitHub", completed: true, priority: "baixa" },
];

// Estado
let tasks = [];
let currentFilter = "all";
let editingTaskId = null;
let iaSugestoes = [];

// Elementos
const taskForm = document.querySelector("#taskForm");
const taskTitle = document.querySelector("#taskTitle");
const taskList = document.querySelector("#taskList");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const formHeading = document.querySelector("#formHeading");
const submitButton = document.querySelector("#submitButton");
const cancelEdit = document.querySelector("#cancelEdit");
const formMessage = document.querySelector("#formMessage");
const resetButton = document.querySelector("#resetButton");
const iaInput = document.querySelector("#iaInput");
const iaButton = document.querySelector("#iaButton");
const iaMessage = document.querySelector("#iaMessage");
const iaSuggestionsBox = document.querySelector("#iaSuggestions");

// ===== Armazenamento local =====

function tarefaValida(item) {
  return (
    item &&
    typeof item.id === "number" &&
    typeof item.title === "string" &&
    item.title.trim() !== "" &&
    typeof item.completed === "boolean"
  );
}

function carregarTarefas() {
  try {
    const salvas = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (Array.isArray(salvas)) {
      // Descarta dados adulterados ou inválidos antes de usar
      return salvas.filter(tarefaValida).map((item) => ({
        id: item.id,
        title: item.title.slice(0, TAMANHO_MAX_TITULO),
        completed: item.completed,
        priority: PRIORIDADES.includes(item.priority) ? item.priority : undefined,
      }));
    }
  } catch (error) {
    console.error("Dados salvos inválidos, usando exemplos:", error);
  }

  return EXEMPLOS.map((item) => ({ ...item }));
}

function salvarTarefas() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Não foi possível salvar no navegador:", error);
    showMessage("Não foi possível salvar no navegador.", true);
  }
}

// ===== Utilidades =====

function gerarId() {
  return Date.now() + Math.floor(Math.random() * 1000000);
}

function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

function mostrarIaMensagem(message, isError = false) {
  iaMessage.textContent = message;
  iaMessage.classList.toggle("error", isError);
}

// ===== Renderização =====

function getVisibleTasks() {
  const search = searchInput.value.trim().toLowerCase();

  return tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(search);
    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "pending" && !task.completed) ||
      (currentFilter === "completed" && task.completed);

    return matchesSearch && matchesFilter;
  });
}

function renderTasks() {
  taskList.replaceChildren();

  const visibleTasks = getVisibleTasks();

  visibleTasks.forEach((task) => {
    const card = document.createElement("article");
    card.className = "task-card";
    if (task.completed) card.classList.add("is-completed");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = task.completed;
    checkbox.setAttribute(
      "aria-label",
      `Marcar ${task.title} como ${task.completed ? "pendente" : "concluída"}`,
    );
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const content = document.createElement("div");
    content.className = "task-content";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("span");
    meta.className = "task-meta";
    meta.textContent = [
      task.completed ? "Concluída" : "Pendente",
      task.priority ? `prioridade ${task.priority}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    content.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "icon-button";
    editButton.textContent = "Editar";
    editButton.setAttribute("aria-label", `Editar ${task.title}`);
    editButton.addEventListener("click", () => startEditing(task.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "icon-button delete-button";
    deleteButton.textContent = "Excluir";
    deleteButton.setAttribute("aria-label", `Excluir ${task.title}`);
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    actions.append(editButton, deleteButton);
    card.append(checkbox, content, actions);
    taskList.append(card);
  });

  emptyState.classList.toggle("hidden", visibleTasks.length !== 0);
  document.querySelector("#visibleCount").textContent =
    `${visibleTasks.length} ${visibleTasks.length === 1 ? "tarefa" : "tarefas"}`;
  document.querySelector("#listDescription").textContent =
    `${visibleTasks.length} resultado(s) encontrado(s)`;

  updateStats();
}

function updateStats() {
  const completed = tasks.filter((task) => task.completed).length;

  document.querySelector("#totalTasks").textContent = tasks.length;
  document.querySelector("#pendingTasks").textContent = tasks.length - completed;
  document.querySelector("#completedTasks").textContent = completed;
}

// ===== Formulário (CREATE e UPDATE) =====

function resetForm() {
  editingTaskId = null;
  taskForm.reset();

  formHeading.textContent = "Nova tarefa";
  submitButton.textContent = "+ Adicionar tarefa";
  cancelEdit.classList.add("hidden");

  showMessage("");
}

function startEditing(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  editingTaskId = id;
  taskTitle.value = task.title;

  formHeading.textContent = "Editar tarefa";
  submitButton.textContent = "Salvar alterações";
  cancelEdit.classList.remove("hidden");

  showMessage("Altere o título e salve.");
  taskTitle.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = taskTitle.value.trim().slice(0, TAMANHO_MAX_TITULO);

  if (!title) {
    showMessage("Digite um título para a tarefa.", true);
    return;
  }

  if (editingTaskId !== null) {
    // UPDATE
    const id = editingTaskId;
    tasks = tasks.map((item) => (item.id === id ? { ...item, title } : item));

    resetForm();
    showMessage("Tarefa atualizada com sucesso!");
  } else {
    // CREATE
    tasks.unshift({ id: gerarId(), title, completed: false });

    resetForm();
    showMessage("Tarefa adicionada com sucesso!");
  }

  salvarTarefas();
  renderTasks();
});

// ===== Ações: concluir e excluir =====

function toggleTask(id) {
  tasks = tasks.map((item) =>
    item.id === id ? { ...item, completed: !item.completed } : item,
  );

  salvarTarefas();
  renderTasks();
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  if (!window.confirm(`Deseja excluir a tarefa "${task.title}"?`)) return;

  tasks = tasks.filter((item) => item.id !== id);

  if (editingTaskId === id) resetForm();

  salvarTarefas();
  renderTasks();
  showMessage("Tarefa excluída com sucesso!");
}

// ===== IA =====

async function gerarComIA() {
  const descricao = iaInput.value.trim();

  if (!descricao) {
    mostrarIaMensagem("Descreva o que você precisa fazer.", true);
    return;
  }

  iaButton.disabled = true;
  mostrarIaMensagem("Gerando sugestões...");

  try {
    const resposta = await fetch(IA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao }),
    });

    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || `Erro HTTP ${resposta.status}`);

    iaSugestoes = dados;
    renderSugestoes();
    mostrarIaMensagem(
      dados.length
        ? `${dados.length} sugestão(ões). Marque as que quiser salvar.`
        : "A IA não sugeriu tarefas. Tente uma descrição mais detalhada.",
    );
  } catch (error) {
    console.error("Falha ao gerar tarefas com IA:", error);
    iaSugestoes = [];
    renderSugestoes();
    mostrarIaMensagem("Não foi possível gerar sugestões agora. Tente de novo.", true);
  } finally {
    iaButton.disabled = false;
  }
}

function renderSugestoes() {
  iaSuggestionsBox.replaceChildren();

  if (iaSugestoes.length === 0) {
    iaSuggestionsBox.classList.add("hidden");
    return;
  }

  iaSuggestionsBox.classList.remove("hidden");

  iaSugestoes.forEach((sugestao, index) => {
    const card = document.createElement("label");
    card.className = "suggestion-card";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = true;
    checkbox.dataset.index = index;

    const texto = document.createElement("span");
    texto.className = "task-title";
    texto.textContent = sugestao.titulo;

    const prioridade = document.createElement("span");
    prioridade.className = `priority ${sugestao.prioridade}`;
    prioridade.textContent = sugestao.prioridade;

    card.append(checkbox, texto, prioridade);
    iaSuggestionsBox.append(card);
  });

  const acoes = document.createElement("div");
  acoes.className = "suggestion-actions";

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "primary-button";
  botao.textContent = "Adicionar selecionadas";
  botao.addEventListener("click", adicionarSugestoesSelecionadas);

  acoes.append(botao);
  iaSuggestionsBox.append(acoes);
}

function adicionarSugestoesSelecionadas() {
  const marcadas = [
    ...iaSuggestionsBox.querySelectorAll("input[type='checkbox']:checked"),
  ].map((checkbox) => iaSugestoes[Number(checkbox.dataset.index)]);

  if (marcadas.length === 0) {
    mostrarIaMensagem("Marque pelo menos uma sugestão.", true);
    return;
  }

  marcadas.forEach((sugestao) => {
    tasks.unshift({
      id: gerarId(),
      title: sugestao.titulo.slice(0, TAMANHO_MAX_TITULO),
      completed: false,
      priority: sugestao.prioridade,
    });
  });

  iaSugestoes = [];
  iaInput.value = "";
  renderSugestoes();

  salvarTarefas();
  renderTasks();
  mostrarIaMensagem(`${marcadas.length} tarefa(s) adicionada(s) à lista.`);
}

// ===== Eventos =====

searchInput.addEventListener("input", renderTasks);

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    document.querySelectorAll(".filter").forEach((filterButton) => {
      filterButton.classList.toggle("active", filterButton === button);
    });

    renderTasks();
  });
});

cancelEdit.addEventListener("click", resetForm);
iaButton.addEventListener("click", gerarComIA);

resetButton.addEventListener("click", () => {
  if (!window.confirm("Restaurar os exemplos? Suas tarefas atuais serão substituídas.")) {
    return;
  }

  tasks = EXEMPLOS.map((item) => ({ ...item }));
  resetForm();
  salvarTarefas();
  renderTasks();
  showMessage("Exemplos restaurados.");
});

// ===== Inicialização =====

tasks = carregarTarefas();
renderTasks();