const API_BASE = '/api';
let clientesCache = [];
let servicosCache = [];
let agendamentosCache = [];
let agendamentoEditId = null;
let clienteEditId = null;

const formatTelefone = (tel) => {
    if (!tel) return '';
    const digits = String(tel).replace(/\D/g, '');
    if (digits.length >= 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (digits.length >= 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return tel;
};

const showMessage = (text, type = 'info') => {
    const container = document.getElementById('messageBox');
    if (!container) return;
    container.textContent = text;
    container.className = `message-box message-${type}`;
    container.style.display = 'block';
    if (type !== 'error') {
        setTimeout(() => { container.style.display = 'none'; }, 4000);
    }
};

const apiCall = async (endpoint, options = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Erro ${response.status}`);
    }
    return response.json();
};

const loadServicos = async () => {
    const select = document.getElementById('tipo_massagem');
    select.innerHTML = '<option value="">Carregando serviços...</option>';
    try {
        servicosCache = await apiCall('/servicos');
    } catch (err) {
        servicosCache = [
            { id: null, nome: 'Relaxante (60min)' },
            { id: null, nome: 'Massagem Modeladora (50min)' },
            { id: null, nome: 'Ventosa (75min)' },
            { id: null, nome: 'Escalda pés (60min)' },
            { id: null, nome: 'Massagem Humanizada (70min)' },
            { id: null, nome: 'Shantalla (70min)' },
            { id: null, nome: 'Drenagem linfática (70min)' }
        ];
    }
    select.innerHTML = '<option value="">Selecione...</option>';
    servicosCache.forEach(servico => {
        const option = document.createElement('option');
        option.value = servico.id || servico.nome;
        option.textContent = servico.nome;
        select.appendChild(option);
    });
};

const loadClientes = async () => {
    try {
        clientesCache = await apiCall('/clientes');
    } catch (err) {
        clientesCache = [];
        showMessage('Não foi possível carregar clientes.', 'error');
    }
    renderClientes();
    updateClienteSelect();
};

const loadAgendamentos = async () => {
    try {
        agendamentosCache = await apiCall('/agendamentos');
    } catch (err) {
        agendamentosCache = [];
        showMessage('Não foi possível carregar agendamentos.', 'error');
    }
    renderAgendamentos();
};

const renderClientes = (filter = '') => {
    const tbody = document.querySelector('#listaClientes tbody');
    tbody.innerHTML = '';
    const search = String(filter).trim().toLowerCase();
    const list = clientesCache
        .filter(c => c.nome.toLowerCase().includes(search) || formatTelefone(c.telefone).toLowerCase().includes(search))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:.7">Nenhum cliente encontrado.</td></tr>';
        return;
    }
    list.forEach(cliente => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cliente.nome}</td>
            <td>${formatTelefone(cliente.telefone)}</td>
            <td>${cliente.email || ''}</td>
            <td class="acoes">
                <button class="btn-edit" data-id="${cliente.id}">Editar</button>
                <button class="btn-remove" data-id="${cliente.id}">Remover</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

const updateClienteSelect = () => {
    const select = document.getElementById('cliente_select');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um cliente</option>';
    clientesCache.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = `${cliente.nome} (${formatTelefone(cliente.telefone)})`;
        select.appendChild(option);
    });
    const newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.textContent = '➕ Novo Cliente';
    select.appendChild(newOption);
};

const renderAgendamentos = () => {
    const tbody = document.querySelector('#listaAgendamentos tbody');
    tbody.innerHTML = '';
    if (!agendamentosCache.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;opacity:.7">Nenhum agendamento cadastrado.</td></tr>';
        return;
    }
    agendamentosCache.sort((a, b) => {
        if (a.data !== b.data) return b.data.localeCompare(a.data);
        return a.hora.localeCompare(b.hora);
    });
    agendamentosCache.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.data}</td>
            <td>${item.hora}</td>
            <td>${item.servico_nome || item.tipo_massagem || '—'}</td>
            <td>${item.cliente_nome || 'Cliente removido'}</td>
            <td>${item.cliente_email || ''}</td>
            <td>${item.observacoes || ''}</td>
            <td class="acoes">
                <button class="btn-edit-agendamento" data-id="${item.id}">Editar</button>
                <button class="btn-remove-agendamento" data-id="${item.id}">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

const resetClienteForm = () => {
    clienteEditId = null;
    document.getElementById('cliente_id').value = '';
    document.getElementById('nome').value = '';
    document.getElementById('telefone').value = '';
    document.getElementById('email').value = '';
    document.getElementById('observacoes_cliente').value = '';
    document.getElementById('cancelClienteEdit').style.display = 'none';
};

const resetAgendamentoForm = () => {
    agendamentoEditId = null;
    document.getElementById('agendamento_id').value = '';
    document.getElementById('data').value = '';
    document.getElementById('hora').value = '';
    document.getElementById('tipo_massagem').value = '';
    document.getElementById('cliente_select').value = '';
    document.getElementById('cliente_nome').value = '';
    document.getElementById('cliente_email').value = '';
    document.getElementById('cliente_telefone').value = '';
    document.getElementById('observacoes').value = '';
    document.getElementById('novocliente-fields').style.display = 'none';
    document.getElementById('cliente_email_group').style.display = 'none';
    document.getElementById('cliente_telefone_group').style.display = 'none';
    document.getElementById('cancelAgendamentoEdit').style.display = 'none';
};

const saveCliente = async (event) => {
    event.preventDefault();
    const cliente = {
        nome: document.getElementById('nome').value.trim(),
        telefone: document.getElementById('telefone').value.trim(),
        email: document.getElementById('email').value.trim(),
        observacoes: document.getElementById('observacoes_cliente').value.trim()
    };
    if (!cliente.nome || !cliente.telefone) {
        showMessage('Nome e telefone são obrigatórios.', 'error');
        return;
    }
    const id = parseInt(document.getElementById('cliente_id').value, 10);
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/clientes/${id}` : '/clientes';
    try {
        await apiCall(endpoint, { method, body: JSON.stringify(cliente) });
        await loadClientes();
        resetClienteForm();
        showMessage(`Cliente ${id ? 'atualizado' : 'adicionado'} com sucesso.`);
    } catch (err) {
        showMessage(err.message, 'error');
    }
};

const saveAgendamento = async (event) => {
    event.preventDefault();
    const agendamento = {
        data: document.getElementById('data').value,
        hora: document.getElementById('hora').value,
        servico_id: document.getElementById('tipo_massagem').value,
        tipo_massagem: document.getElementById('tipo_massagem').value,
        cliente_id: document.getElementById('cliente_select').value,
        cliente_nome: document.getElementById('cliente_nome').value.trim(),
        cliente_email: document.getElementById('cliente_email').value.trim(),
        cliente_telefone: document.getElementById('cliente_telefone').value.trim(),
        observacoes: document.getElementById('observacoes').value.trim()
    };

    if (!agendamento.data || !agendamento.hora || !agendamento.servico_id) {
        showMessage('Data, hora e tipo de massagem são obrigatórios.', 'error');
        return;
    }
    if (!agendamento.cliente_id && !agendamento.cliente_nome) {
        showMessage('Selecione um cliente ou preencha os dados do novo cliente.', 'error');
        return;
    }
    if (agendamento.cliente_id !== 'new') {
        agendamento.cliente_id = parseInt(agendamento.cliente_id, 10);
    } else {
        agendamento.cliente_id = null;
    }
    const method = agendamentoEditId ? 'PUT' : 'POST';
    const endpoint = agendamentoEditId ? `/agendamentos/${agendamentoEditId}` : '/agendamentos';
    try {
        await apiCall(endpoint, { method, body: JSON.stringify(agendamento) });
        await loadAgendamentos();
        await loadClientes();
        resetAgendamentoForm();
        showMessage(`Agendamento ${agendamentoEditId ? 'atualizado' : 'salvo'} com sucesso.`);
    } catch (err) {
        showMessage(err.message, 'error');
    }
};

const editCliente = async (id) => {
    try {
        const cliente = await apiCall(`/clientes/${id}`);
        clienteEditId = cliente.id;
        document.getElementById('cliente_id').value = cliente.id;
        document.getElementById('nome').value = cliente.nome;
        document.getElementById('telefone').value = cliente.telefone;
        document.getElementById('email').value = cliente.email || '';
        document.getElementById('observacoes_cliente').value = cliente.observacoes || '';
        document.getElementById('cancelClienteEdit').style.display = 'inline-flex';
        showMessage('Editando cliente. Faça as alterações e salve.');
    } catch (err) {
        showMessage(err.message, 'error');
    }
};

const removeCliente = async (id) => {
    if (!confirm('Remover este cliente? Agendamentos associados continuarão visíveis.')) return;
    try {
        await apiCall(`/clientes/${id}`, { method: 'DELETE' });
        await loadClientes();
        await loadAgendamentos();
        showMessage('Cliente removido.');
    } catch (err) {
        showMessage(err.message, 'error');
    }
};

const editAgendamento = async (id) => {
    try {
        const agendamento = await apiCall(`/agendamentos/${id}`);
        agendamentoEditId = agendamento.id;
        document.getElementById('agendamento_id').value = agendamento.id;
        document.getElementById('data').value = agendamento.data;
        document.getElementById('hora').value = agendamento.hora;
        document.getElementById('tipo_massagem').value = agendamento.servico_id || agendamento.servico_nome || agendamento.tipo_massagem || '';
        document.getElementById('cliente_select').value = agendamento.cliente_id || 'new';
        document.getElementById('cliente_nome').value = agendamento.cliente_nome || '';
        document.getElementById('cliente_email').value = agendamento.cliente_email || '';
        document.getElementById('cliente_telefone').value = agendamento.cliente_telefone || '';
        document.getElementById('observacoes').value = agendamento.observacoes || '';
        if (!agendamento.cliente_id) {
            document.getElementById('novocliente-fields').style.display = 'block';
            document.getElementById('cliente_email_group').style.display = 'block';
            document.getElementById('cliente_telefone_group').style.display = 'block';
            document.getElementById('cliente_select').value = 'new';
        }
        document.getElementById('cancelAgendamentoEdit').style.display = 'inline-flex';
        showMessage('Editando agendamento. Atualize os dados e salve.');
    } catch (err) {
        showMessage(err.message, 'error');
    }
};

const removeAgendamento = async (id) => {
    if (!confirm('Excluir este agendamento?')) return;
    try {
        await apiCall(`/agendamentos/${id}`, { method: 'DELETE' });
        await loadAgendamentos();
        showMessage('Agendamento excluído.');
    } catch (err) {
        showMessage(err.message, 'error');
    }
};

const setupEvents = () => {
    document.getElementById('formCliente').addEventListener('submit', saveCliente);
    document.getElementById('formAgendamento').addEventListener('submit', saveAgendamento);
    document.getElementById('searchInput').addEventListener('input', (event) => renderClientes(event.target.value));
    document.getElementById('btnNovoCliente').addEventListener('click', () => {
        resetClienteForm();
        showMessage('Preencha os dados do cliente e salve.');
    });
    document.getElementById('cancelClienteEdit').addEventListener('click', resetClienteForm);
    document.getElementById('cancelAgendamentoEdit').addEventListener('click', resetAgendamentoForm);
    document.getElementById('cliente_select').addEventListener('change', (event) => {
        const isNew = event.target.value === 'new';
        document.getElementById('novocliente-fields').style.display = isNew ? 'block' : 'none';
        document.getElementById('cliente_email_group').style.display = isNew ? 'block' : 'none';
        document.getElementById('cliente_telefone_group').style.display = isNew ? 'block' : 'none';
        if (!isNew) {
            document.getElementById('cliente_nome').value = '';
            document.getElementById('cliente_email').value = '';
            document.getElementById('cliente_telefone').value = '';
        }
    });
    document.querySelector('#listaClientes tbody').addEventListener('click', (event) => {
        const target = event.target;
        const id = target.dataset.id;
        if (!id) return;
        if (target.classList.contains('btn-edit')) editCliente(id);
        if (target.classList.contains('btn-remove')) removeCliente(id);
    });
    document.querySelector('#listaAgendamentos tbody').addEventListener('click', (event) => {
        const target = event.target;
        const id = target.dataset.id;
        if (!id) return;
        if (target.classList.contains('btn-edit-agendamento')) editAgendamento(id);
        if (target.classList.contains('btn-remove-agendamento')) removeAgendamento(id);
    });
};

window.formatTelefone = formatTelefone;

// Switch tabs
window.showTab = (evt, tab) => {
    if (evt) evt.preventDefault();
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(tab);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }
    if (evt?.currentTarget) evt.currentTarget.classList.add('active');
};

document.addEventListener('DOMContentLoaded', async () => {
    setupEvents();
    await loadServicos();
    await loadClientes();
    await loadAgendamentos();
    resetClienteForm();
    resetAgendamentoForm();
    showTab(null, 'clientes');
});
