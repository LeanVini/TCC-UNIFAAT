const API_BASE = '/api';
const STORAGE_KEY = 'clientes-cache'; // Fallback cache

// Utils
const showLoading = (show = true) => {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
  document.getElementById('listaClientes').style.display = show ? 'none' : 'table';
  document.getElementById('emptyState').style.display = 'none';
};

const showError = (msg, clear = true) => {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
  if (clear) setTimeout(() => el.style.display = 'none', 5000);
};

const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

// API Calls
const apiCall = async (endpoint, options = {}) => {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Erro ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.error('API Error:', err);
    // Fallback to localStorage for offline
    return null;
  }
};

const fetchClientes = async () => {
  showLoading(true);
  let clientes = await apiCall('/clientes');
  if (!clientes) {
    // Fallback
    clientes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }
  showLoading(false);
  return clientes;
};

const saveCliente = async (cliente) => {
  const method = cliente.id ? 'PUT' : 'POST';
  const url = cliente.id ? `/clientes/${cliente.id}` : '/clientes';
  const res = await apiCall(url, {
    method,
    body: JSON.stringify(cliente)
  });
  // Update cache
  if (res) localStorage.setItem(STORAGE_KEY, JSON.stringify(await fetchClientes()));
  return res;
};

const deleteCliente = async (id) => {
  const res = await apiCall(`/clientes/${id}`, { method: 'DELETE' });
  if (res) localStorage.setItem(STORAGE_KEY, JSON.stringify(await fetchClientes()));
  return res;
};

// Validation
const validateCliente = (cliente) => {
  const errors = [];
  if (!cliente.nome?.trim()) errors.push('Nome é obrigatório');
  if (!cliente.telefone?.trim()) errors.push('Telefone é obrigatório');
  if (cliente.email && !/^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$/.test(cliente.email)) errors.push('Email inválido');
  return errors;
};

// Formatters
const formatTelefone = (tel) => {
  if (!tel) return '';
  const digits = tel.replace(/\D/g, '');
  if (digits.length >= 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length >= 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return tel;
};

// Render
const renderClientes = (clientes = [], searchTerm = '') => {
  const tbody = document.querySelector('#listaClientes tbody');
  tbody.innerHTML = '';

  let filtered = clientes.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatTelefone(c.telefone).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!filtered.length) {
    document.getElementById('emptyState').style.display = 'block';
    return;
  }

  filtered.sort((a, b) => a.nome.localeCompare(b.nome));

  filtered.forEach(cliente => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cliente.nome}</td>
      <td>${formatTelefone(cliente.telefone)}</td>
      <td>${cliente.email || ''}</td>
      <td>${cliente.observacoes?.substring(0, 50)}${cliente.observacoes?.length > 50 ? '...' : ''}</td>
      <td class="acoes">
        <button class="btn-edit" data-id="${cliente.id}">Editar</button>
        <button class="btn-remover" data-id="${cliente.id}">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
<<<<<<< HEAD
};

// Form handling
const populateForm = (cliente = null, isModal = false) => {
  const prefix = isModal ? 'modal' : '';
  document.getElementById(`${prefix}editId`).value = cliente?.id || '';
  document.getElementById(`${prefix}nome`).value = cliente?.nome || '';
  document.getElementById(`${prefix}telefone`).value = cliente?.telefone || '';
  document.getElementById(`${prefix}email`).value = cliente?.email || '';
  document.getElementById(`${prefix}observacoes`).value = cliente?.observacoes || '';
};

const getFormData = (isModal = false) => {
  const prefix = isModal ? 'modal' : '';
  return {
    id: document.getElementById(`${prefix}editId`).value,
    nome: document.getElementById(`${prefix}nome`).value.trim(),
    telefone: document.getElementById(`${prefix}telefone`).value.trim(),
    email: document.getElementById(`${prefix}email`).value.trim(),
    observacoes: document.getElementById(`${prefix}observacoes`).value.trim()
  };
};

const submitHandler = async (e, isModal = false) => {
  e.preventDefault();
  const cliente = getFormData(isModal);
  const errors = validateCliente(cliente);
  if (errors.length) {
    showError(errors.join(', '));
    return;
  }

  try {
    await saveCliente(cliente);
    loadClientes();
    if (isModal) closeModal();
    else document.getElementById('formCliente').style.display = 'none';
    showError('Cliente salvo com sucesso!', false);
  } catch (err) {
    showError('Erro ao salvar: ' + err.message);
  }
};

const editCliente = (id) => {
  fetchClientes().then(clientes => {
    const cliente = clientes.find(c => c.id == id);
    if (cliente) {
      populateForm(cliente);
      document.getElementById('formCliente').style.display = 'block';
      document.getElementById('nome').focus();
    }
  });
};

const confirmDelete = (id) => {
  if (confirm('Remover este cliente? Agendamentos associados serão mantidos.')) {
    deleteCliente(id).then(() => loadClientes());
  }
};

const setupEvents = () => {
  // Form
  document.getElementById('formCliente').addEventListener('submit', e => submitHandler(e));

  // Cancel
  document.getElementById('cancelEdit').onclick = () => {
    document.getElementById('formCliente').style.display = 'none';
  };

  // Search debounce
  document.getElementById('searchInput').addEventListener('input', debounce((e) => {
    renderClientes(clientesCache, e.target.value);
  }, 300));

  // Table events
  document.querySelector('#listaClientes tbody').addEventListener('click', e => {
    if (e.target.classList.contains('btn-edit')) editCliente(e.target.dataset.id);
    if (e.target.classList.contains('btn-remover')) confirmDelete(e.target.dataset.id);
  });

  // Modal events
  document.getElementById('editModal').onclick = closeModal;
  document.getElementById('closeModal').onclick = closeModal;
  document.getElementById('modalForm').addEventListener('submit', e => submitHandler(e, true));

  // Input mask telefone (simple)
  ['telefone', 'modalTelefone'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      e.target.value = formatTelefone(e.target.value);
    });
  });
};

let clientesCache = [];

const loadClientes = async () => {
  clientesCache = await fetchClientes();
  renderClientes(clientesCache);
};

const closeModal = () => {
  document.getElementById('editModal').style.display = 'none';
};

// Init
document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  loadClientes();
});

=======
}

function adicionarCliente(event) {
  event.preventDefault();

  const nomeInput = document.getElementById("nome");
  const telefoneInput = document.getElementById("telefone");
  const emailInput = document.getElementById("email");

  const novoCliente = {
    id: Date.now(),
    nome: nomeInput.value.trim(),
    telefone: telefoneInput.value.trim(),
    email: emailInput.value.trim(),
  };

  if (!novoCliente.nome) {
    nomeInput.focus();
    return;
  }

  const clientes = getClientes();
  clientes.push(novoCliente);
  saveClientes(clientes);
  renderClientes();

  document.getElementById("formCliente").reset();
  nomeInput.focus();
}

function handleTableClick(event) {
  if (!event.target.matches("button.btn-remover")) return;
  const id = Number(event.target.dataset.id);
  if (!id) return;

  const clientes = getClientes().filter((c) => c.id !== id);
  saveClientes(clientes);
  renderClientes();
}

function init() {
  document.getElementById("formCliente").addEventListener("submit", adicionarCliente);
  document.querySelector("#listaClientes tbody").addEventListener("click", handleTableClick);
  renderClientes();
}

document.addEventListener("DOMContentLoaded", init);
>>>>>>> 7a42470e9cbd13f0240a3c6cbbdb5217bda6277d
