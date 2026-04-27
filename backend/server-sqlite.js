require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const Joi = require('joi');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Inicializar banco de dados SQLite
const db = new sqlite3.Database(path.join(__dirname, 'agenda_massagem.db'), (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('Conectado ao banco de dados SQLite');
        initializeDatabase();
    }
});

const clienteSchema = Joi.object({
    nome: Joi.string().trim().min(2).max(100).required(),
    telefone: Joi.string().trim().min(8).max(20).required(),
    email: Joi.string().trim().email({ tlds: { allow: false } }).max(100).allow('', null),
    observacoes: Joi.string().trim().max(1000).allow('', null)
});

const agendamentoSchema = Joi.object({
    cliente_id: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().pattern(/^\d+$/)).optional().allow(null, ''),
    cliente_nome: Joi.string().trim().min(2).max(100).optional().allow('', null),
    cliente_telefone: Joi.string().trim().min(8).max(20).optional().allow('', null),
    cliente_email: Joi.string().trim().email({ tlds: { allow: false } }).max(100).optional().allow('', null),
    servico_id: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().pattern(/^\d+$/)).optional().allow(null, ''),
    tipo_massagem: Joi.string().trim().max(100).optional().allow('', null),
    data: Joi.date().iso().required(),
    hora: Joi.string().pattern(/^([0-1]?\d|2[0-3]):[0-5]\d$/).required(),
    observacoes: Joi.string().trim().max(1000).allow('', null)
});

// Inicializar tabelas
function initializeDatabase() {
    db.serialize(() => {
        // Criar tabela de clientes
        db.run(`
            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                telefone TEXT NOT NULL,
                email TEXT,
                observacoes TEXT
            )
        `);

        // Criar tabela de serviços
        db.run(`
            CREATE TABLE IF NOT EXISTS servicos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL UNIQUE,
                duracao INTEGER,
                preco REAL
            )
        `);

        // Criar tabela de agendamentos
        db.run(`
            CREATE TABLE IF NOT EXISTS agendamentos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_id INTEGER,
                servico_id INTEGER,
                data DATE NOT NULL,
                hora TIME NOT NULL,
                observacoes TEXT,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id),
                FOREIGN KEY (servico_id) REFERENCES servicos(id)
            )
        `);

        // Inserir serviços padrão
        const servicos = [
            { nome: 'Massagem Relaxante', duracao: 60, preco: 120.00 },
            { nome: 'Massagem Sueca', duracao: 50, preco: 110.00 },
            { nome: 'Massagem Shiatsu', duracao: 45, preco: 100.00 },
            { nome: 'Drenagem Linfática', duracao: 75, preco: 150.00 },
            { nome: 'Massagem Modeladora', duracao: 60, preco: 130.00 },
            { nome: 'Relaxante (60min)', duracao: 60, preco: 120.00 },
            { nome: 'Massagem Modeladora (50min)', duracao: 50, preco: 130.00 },
            { nome: 'Ventosa (75min)', duracao: 75, preco: 140.00 },
            { nome: 'Escalda pés (60min)', duracao: 60, preco: 80.00 },
            { nome: 'Massagem Humanizada (70min)', duracao: 70, preco: 125.00 },
            { nome: 'Shantalla (70min)', duracao: 70, preco: 135.00 }
        ];

        servicos.forEach(s => {
            db.run(
                'INSERT OR IGNORE INTO servicos (nome, duracao, preco) VALUES (?, ?, ?)',
                [s.nome, s.duracao, s.preco],
                (err) => {
                    if (err && !err.message.includes('UNIQUE constraint failed')) {
                        console.error('Erro ao inserir serviço:', err);
                    }
                }
            );
        });
    });
}

const parseId = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toDateString = (value) => {
    if (!value) return value;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
};

app.get('/health', (req, res) => {
    res.json({ status: 'OK', db: 'connected' });
});

app.get('/api/clientes', (req, res) => {
    db.all('SELECT * FROM clientes ORDER BY nome', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

app.get('/api/clientes/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de cliente inválido' });
    db.get('SELECT * FROM clientes WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Cliente não encontrado' });
        res.json(row);
    });
});

app.post('/api/clientes', (req, res) => {
    const { error } = clienteSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    
    db.run(
        'INSERT INTO clientes (nome, telefone, email, observacoes) VALUES (?, ?, ?, ?)',
        [req.body.nome, req.body.telefone, req.body.email || '', req.body.observacoes || ''],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT * FROM clientes WHERE id = ?', [this.lastID], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json(row);
            });
        }
    );
});

app.put('/api/clientes/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de cliente inválido' });
    const { error } = clienteSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    
    db.run(
        'UPDATE clientes SET nome = ?, telefone = ?, email = ?, observacoes = ? WHERE id = ?',
        [req.body.nome, req.body.telefone, req.body.email || '', req.body.observacoes || '', id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
            db.get('SELECT * FROM clientes WHERE id = ?', [id], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(row);
            });
        }
    );
});

app.delete('/api/clientes/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de cliente inválido' });
    
    db.run('BEGIN TRANSACTION', (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run('UPDATE agendamentos SET cliente_id = NULL WHERE cliente_id = ?', [id], (err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            
            db.run('DELETE FROM clientes WHERE id = ?', [id], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(404).json({ error: 'Cliente não encontrado' });
                }
                db.run('COMMIT', (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true });
                });
            });
        });
    });
});

app.get('/api/servicos', (req, res) => {
    db.all('SELECT * FROM servicos ORDER BY nome', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/agendamentos', (req, res) => {
    db.all(`
        SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email,
               s.nome as servico_nome, s.duracao, s.preco
        FROM agendamentos a
        LEFT JOIN clientes c ON a.cliente_id = c.id
        LEFT JOIN servicos s ON a.servico_id = s.id
        ORDER BY a.data DESC, a.hora
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formattedRows = (rows || []).map(row => ({ ...row, data: toDateString(row.data) }));
        res.json(formattedRows);
    });
});

app.get('/api/agendamentos/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de agendamento inválido' });
    
    db.get(`
        SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email,
               s.nome as servico_nome, s.duracao, s.preco
        FROM agendamentos a
        LEFT JOIN clientes c ON a.cliente_id = c.id
        LEFT JOIN servicos s ON a.servico_id = s.id
        WHERE a.id = ?
    `, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Agendamento não encontrado' });
        row.data = toDateString(row.data);
        res.json(row);
    });
});

app.post('/api/agendamentos', (req, res) => {
    const { error } = agendamentoSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    
    // Resolver cliente
    let clienteId = parseId(req.body.cliente_id);
    const processarAgendamento = () => {
        // Resolver serviço
        let servicoId = parseId(req.body.servico_id);
        if (!servicoId && req.body.tipo_massagem) {
            db.get('SELECT id FROM servicos WHERE nome = ?', [req.body.tipo_massagem], (err, row) => {
                if (row) {
                    servicoId = row.id;
                    inserirAgendamento();
                } else {
                    db.run(
                        'INSERT INTO servicos (nome, duracao, preco) VALUES (?, ?, ?)',
                        [req.body.tipo_massagem, 60, 0.00],
                        function(err) {
                            if (err) return res.status(500).json({ error: err.message });
                            servicoId = this.lastID;
                            inserirAgendamento();
                        }
                    );
                }
            });
        } else if (servicoId) {
            inserirAgendamento();
        } else {
            return res.status(400).json({ error: 'Serviço inválido ou tipo de massagem obrigatório' });
        }
    };
    
    const inserirAgendamento = () => {
        db.run(
            'INSERT INTO agendamentos (cliente_id, servico_id, data, hora, observacoes) VALUES (?, ?, ?, ?, ?)',
            [clienteId || null, servicoId, req.body.data, req.body.hora, req.body.observacoes || ''],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                db.get(`
                    SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email,
                           s.nome as servico_nome, s.duracao, s.preco
                    FROM agendamentos a
                    LEFT JOIN clientes c ON a.cliente_id = c.id
                    LEFT JOIN servicos s ON a.servico_id = s.id
                    WHERE a.id = ?
                `, [this.lastID], (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    row.data = toDateString(row.data);
                    res.status(201).json(row);
                });
            }
        );
    };
    
    if (!clienteId && req.body.cliente_nome) {
        db.run(
            'INSERT INTO clientes (nome, telefone, email, observacoes) VALUES (?, ?, ?, ?)',
            [req.body.cliente_nome, req.body.cliente_telefone || '', req.body.cliente_email || '', ''],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                clienteId = this.lastID;
                processarAgendamento();
            }
        );
    } else {
        processarAgendamento();
    }
});

app.put('/api/agendamentos/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de agendamento inválido' });
    const { error } = agendamentoSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    
    db.get('SELECT id FROM agendamentos WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Agendamento não encontrado' });
        
        let clienteId = parseId(req.body.cliente_id);
        const processarAtualizacao = () => {
            let servicoId = parseId(req.body.servico_id);
            if (!servicoId && req.body.tipo_massagem) {
                db.get('SELECT id FROM servicos WHERE nome = ?', [req.body.tipo_massagem], (err, row) => {
                    if (row) {
                        servicoId = row.id;
                        atualizarAgendamento();
                    } else {
                        db.run(
                            'INSERT INTO servicos (nome, duracao, preco) VALUES (?, ?, ?)',
                            [req.body.tipo_massagem, 60, 0.00],
                            function(err) {
                                if (err) return res.status(500).json({ error: err.message });
                                servicoId = this.lastID;
                                atualizarAgendamento();
                            }
                        );
                    }
                });
            } else if (servicoId) {
                atualizarAgendamento();
            } else {
                return res.status(400).json({ error: 'Serviço inválido ou tipo de massagem obrigatório' });
            }
        };
        
        const atualizarAgendamento = () => {
            db.run(
                'UPDATE agendamentos SET cliente_id = ?, servico_id = ?, data = ?, hora = ?, observacoes = ? WHERE id = ?',
                [clienteId || null, servicoId, req.body.data, req.body.hora, req.body.observacoes || '', id],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    db.get(`
                        SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email,
                               s.nome as servico_nome, s.duracao, s.preco
                        FROM agendamentos a
                        LEFT JOIN clientes c ON a.cliente_id = c.id
                        LEFT JOIN servicos s ON a.servico_id = s.id
                        WHERE a.id = ?
                    `, [id], (err, row) => {
                        if (err) return res.status(500).json({ error: err.message });
                        row.data = toDateString(row.data);
                        res.json(row);
                    });
                }
            );
        };
        
        if (!clienteId && req.body.cliente_nome) {
            db.run(
                'INSERT INTO clientes (nome, telefone, email, observacoes) VALUES (?, ?, ?, ?)',
                [req.body.cliente_nome, req.body.cliente_telefone || '', req.body.cliente_email || '', ''],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    clienteId = this.lastID;
                    processarAtualizacao();
                }
            );
        } else {
            processarAtualizacao();
        }
    });
});

app.delete('/api/agendamentos/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de agendamento inválido' });
    
    db.run('DELETE FROM agendamentos WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
        res.json({ success: true });
    });
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Rota não encontrada' });
    }
    res.sendFile(path.join(__dirname, '../frontend/agendamentos.html'));
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

process.on('SIGINT', () => {
    console.log('Fechando banco de dados...');
    db.close(() => {
        process.exit(0);
    });
});
