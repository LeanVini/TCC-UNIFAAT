require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const Joi = require('joi');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
// Serve static files from frontend directory
const frontendPath = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendPath));

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'agenda_massagem',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00'
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

const resolveClienteId = async (conn, body) => {
    const clienteId = parseId(body.cliente_id);
    if (clienteId) return clienteId;
    if (!body.cliente_nome) return null;
    const [clienteResult] = await conn.execute(
        'INSERT INTO clientes (nome, telefone, email, observacoes) VALUES (?, ?, ?, ?)',
        [body.cliente_nome, body.cliente_telefone || '', body.cliente_email || '', '']
    );
    return clienteResult.insertId;
};

const resolveServicoId = async (conn, body) => {
    const servicoId = parseId(body.servico_id);
    if (servicoId) return servicoId;
    const tipo = body.tipo_massagem?.trim();
    if (!tipo) return null;
    const [rows] = await conn.execute('SELECT id FROM servicos WHERE nome = ?', [tipo]);
    if (rows.length) return rows[0].id;
    const [result] = await conn.execute(
        'INSERT INTO servicos (nome, duracao, preco) VALUES (?, ?, ?)',
        [tipo, 60, 0.00]
    );
    return result.insertId;
};

app.get('/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        res.json({ status: 'OK', db: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'Error', db: 'disconnected' });
    }
});

app.get('/api/clientes', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM clientes ORDER BY nome');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/clientes/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de cliente inválido' });
    try {
        const [rows] = await pool.execute('SELECT * FROM clientes WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clientes', async (req, res) => {
    const { error } = clienteSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    try {
        const [result] = await pool.execute(
            'INSERT INTO clientes (nome, telefone, email, observacoes) VALUES (?, ?, ?, ?)',
            [req.body.nome, req.body.telefone, req.body.email || '', req.body.observacoes || '']
        );
        const [clientes] = await pool.execute('SELECT * FROM clientes WHERE id = ?', [result.insertId]);
        if (!clientes || clientes.length === 0) {
            return res.status(500).json({ error: 'Erro ao recuperar cliente criado' });
        }
        res.status(201).json(clientes[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de cliente inválido' });
    const { error } = clienteSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    try {
        const [result] = await pool.execute(
            'UPDATE clientes SET nome = ?, telefone = ?, email = ?, observacoes = ? WHERE id = ?',
            [req.body.nome, req.body.telefone, req.body.email || '', req.body.observacoes || '', id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
        const [cliente] = await pool.execute('SELECT * FROM clientes WHERE id = ?', [id]);
        res.json(cliente[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de cliente inválido' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('UPDATE agendamentos SET cliente_id = NULL WHERE cliente_id = ?', [id]);
        const [result] = await conn.execute('DELETE FROM clientes WHERE id = ?', [id]);
        await conn.commit();
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

app.get('/api/servicos', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM servicos ORDER BY nome');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/agendamentos', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email,
                   s.nome as servico_nome, s.duracao, s.preco
            FROM agendamentos a
            LEFT JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN servicos s ON a.servico_id = s.id
            ORDER BY a.data DESC, a.hora
        `);
        res.json(rows.map(row => ({ ...row, data: toDateString(row.data) })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/agendamentos/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de agendamento inválido' });
    try {
        const [rows] = await pool.execute(`
            SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email,
                   s.nome as servico_nome, s.duracao, s.preco
            FROM agendamentos a
            LEFT JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN servicos s ON a.servico_id = s.id
            WHERE a.id = ?
        `, [id]);
        if (!rows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
        const agendamento = rows[0];
        agendamento.data = toDateString(agendamento.data);
        res.json(agendamento);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/agendamentos', async (req, res) => {
    const { error } = agendamentoSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const clienteId = await resolveClienteId(conn, req.body);
        const servicoId = await resolveServicoId(conn, req.body);
        if (!servicoId) {
            await conn.rollback();
            return res.status(400).json({ error: 'Serviço inválido ou tipo de massagem obrigatório' });
        }
        const [result] = await conn.execute(
            'INSERT INTO agendamentos (cliente_id, servico_id, data, hora, observacoes) VALUES (?, ?, ?, ?, ?)',
            [clienteId, servicoId, req.body.data, req.body.hora, req.body.observacoes || '']
        );
        await conn.commit();
        const [agendamentos] = await pool.execute(`
            SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email,
                   s.nome as servico_nome, s.duracao, s.preco
            FROM agendamentos a
            LEFT JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN servicos s ON a.servico_id = s.id
            WHERE a.id = ?
        `, [result.insertId]);
        if (!agendamentos || agendamentos.length === 0) {
            return res.status(500).json({ error: 'Erro ao recuperar agendamento criado' });
        }
        const agendamento = agendamentos[0];
        agendamento.data = toDateString(agendamento.data);
        res.status(201).json(agendamento);
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

app.put('/api/agendamentos/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de agendamento inválido' });
    const { error } = agendamentoSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const conn = await pool.getConnection();
    try {
        const [existing] = await conn.execute('SELECT id FROM agendamentos WHERE id = ?', [id]);
        if (!existing.length) {
            conn.release();
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }
        await conn.beginTransaction();
        const clienteId = await resolveClienteId(conn, req.body);
        const servicoId = await resolveServicoId(conn, req.body);
        if (!servicoId) {
            await conn.rollback();
            return res.status(400).json({ error: 'Serviço inválido ou tipo de massagem obrigatório' });
        }
        await conn.execute(
            'UPDATE agendamentos SET cliente_id = ?, servico_id = ?, data = ?, hora = ?, observacoes = ? WHERE id = ?',
            [clienteId, servicoId, req.body.data, req.body.hora, req.body.observacoes || '', id]
        );
        await conn.commit();
        const [rows] = await pool.execute('SELECT * FROM agendamentos WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

app.delete('/api/agendamentos/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de agendamento inválido' });
    try {
        const [result] = await pool.execute('DELETE FROM agendamentos WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Rota não encontrada' });
    }
    res.sendFile(path.join(frontendPath, 'agendamentos.html'));
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

process.on('SIGTERM', async () => {
    console.log('Fechando pool de conexões...');
    await pool.end();
    process.exit(0);
});
