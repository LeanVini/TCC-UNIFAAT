document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('formAgendamento');
    const tabela = document.querySelector('#listaAgendamentos tbody');
    const selectTipo = document.getElementById('tipo_massagem');
    const clienteSelect = document.getElementById('cliente_select');
    const novoClienteFields = document.getElementById('novocliente-fields');

    let agendamentoEditando = null;
    let clientes = []; // Cache local

    // Função para carregar clientes do localStorage
    function carregarClientes() {
        if (typeof getClientes === 'function') {
            clientes = getClientes();
            clienteSelect.innerHTML = '<option value="">Selecione um cliente</option><option value="new">+ Novo Cliente</option>';
            clientes.forEach(cliente => {
                const opt = document.createElement('option');
                opt.value = cliente.id;
                opt.textContent = cliente.nome + ' (' + formatTelefone(cliente.telefone) + ')';
                clienteSelect.appendChild(opt);
            });
        }
    }

    // Listener para seleção de cliente
    clienteSelect.addEventListener('change', function() {
        if (this.value === 'new') {
            novoClienteFields.style.display = 'block';
            novoClienteFields.querySelector('#cliente_nome').focus();
        } else {
            novoClienteFields.style.display = 'none';
            novoClienteFields.querySelectorAll('input').forEach(input => input.value = '');
        }
    });

    // Carrega tipos de massagem (hardcoded + API fallback)
    const massagensDefault = {
        'relaxante': 'Relaxante (60min)',
        'shiatsu': 'Shiatsu (50min)',
        'deep_tissue': 'Deep Tissue (75min)',
        'hot_stone': 'Pedras Quentes (60min)',
        'ayurvedica': 'Aromaterapia Ayurvédica (70min)'
    };
    Object.entries(massagensDefault).forEach(([value, text]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        selectTipo.appendChild(opt);
    });

    // Tenta carregar da API também
    fetch('/api/servicos').catch(() => {}).then(res => res ? res.json() : []).then(servicos => {
        servicos.forEach(servico => {
            const opt = document.createElement('option');
            opt.value = servico.id;
            opt.textContent = servico.nome;
            selectTipo.appendChild(opt);
        });
    });

    // Carrega clientes iniciais
    carregarClientes();

    // Carrega agendamentos (adiciona mock se API falhar)
    function carregarAgendamentos() {
        tabela.innerHTML = '';
        fetch('/api/agendamentos')
            .then(res => res.json())
            .catch(() => []) // Mock vazio se offline
            .then(agendamentos => {
                agendamentos.forEach(ag => {
                    const clienteNome = ag.cliente_nome || 'N/D';
                    const clienteEmail = ag.cliente_email || '';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${ag.data}</td>
                        <td>${ag.hora}</td>
                        <td>${ag.tipo_massagem || ag.servico_nome}</td>
                        <td>${clienteNome}</td>
                        <td>${clienteEmail}</td>
                        <td>${ag.observacoes || ''}</td>
                        <td class="acoes">
                            <button onclick="editarAgendamento(${ag.id})">Editar</button>
                            <button onclick="excluirAgendamento(${ag.id})">Excluir</button>
                        </td>
                    `;
                    tabela.appendChild(tr);
                });
            });
    }
    carregarAgendamentos();

    // Submete agendamento
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const data = document.getElementById('data').value;
        const hora = document.getElementById('hora').value;
        const tipoMassagem = selectTipo.value;
        const clienteId = clienteSelect.value;
        let clienteNome, clienteEmail, clienteTelefone;

        if (clienteId === 'new') {
            clienteNome = document.getElementById('cliente_nome').value.trim();
            clienteEmail = document.getElementById('cliente_email').value.trim();
            clienteTelefone = document.getElementById('cliente_telefone').value.trim();
            if (!clienteNome) return alert('Nome do cliente é obrigatório');
        } else if (clientes.length) {
            const cliente = clientes.find(c => c.id == clienteId);
            if (cliente) {
                clienteNome = cliente.nome;
                clienteEmail = cliente.email;
                clienteTelefone = cliente.telefone;
            }
        }

        const payload = { 
            data, 
            hora, 
            tipo_massagem: tipoMassagem,
            cliente_id: clienteId !== 'new' ? clienteId : null,
            cliente_nome: clienteNome,
            cliente_email: clienteEmail,
            cliente_telefone: clienteTelefone,
            observacoes: document.getElementById('observacoes').value 
        };

        const url = agendamentoEditando ? `/api/agendamentos/${agendamentoEditando}` : '/api/agendamentos';
        const method = agendamentoEditando ? 'PUT' : 'POST';

        fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(() => {
            agendamentoEditando = null;
            form.reset();
            novoClienteFields.style.display = 'none';
            clienteSelect.value = '';
            carregarAgendamentos();
            carregarClientes(); // Refresh se novo cliente adicionado via clientes.js
        }).catch(err => {
            console.error('Erro ao salvar:', err);
            alert('Erro ao salvar agendamento. Verifique o backend.');
        });
    });

    // Editar
    window.editarAgendamento = function(id) {
        fetch(`/api/agendamentos/${id}`) // Assumindo endpoint GET single
            .then(res => res.json())
            .catch(() => ({id, cliente_nome: 'Demo'})) // Mock
            .then(ag => {
                document.getElementById('data').value = ag.data;
                document.getElementById('hora').value = ag.hora;
                selectTipo.value = ag.tipo_massagem || '';
                clienteSelect.value = ag.cliente_id || '';
                if (ag.cliente_nome) {
                    document.getElementById('cliente_nome').value = ag.cliente_nome;
                    document.getElementById('cliente_email').value = ag.cliente_email || '';
                }
                document.getElementById('observacoes').value = ag.observacoes || '';
                if (ag.cliente_id === null || clienteSelect.value === 'new') novoClienteFields.style.display = 'block';
                agendamentoEditando = ag.id;
            });
    };

    // Excluir
    window.excluirAgendamento = function(id) {
        if (confirm('Deseja excluir?')) {
            fetch(`/api/agendamentos/${id}`, {method: 'DELETE'})
                .then(() => carregarAgendamentos());
        }
    };

    // Helper telefone (se não definido em clientes.js)
    window.formatTelefone = window.formatTelefone || function(tel) {
        if (!tel) return '';
        const digits = tel.replace(/\D/g, '');
        return digits.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    };
});
