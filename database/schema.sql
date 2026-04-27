-- Cria o banco de dados
CREATE DATABASE agenda_massagem;

-- Seleciona o banco de dados
USE agenda_massagem;

-- Cria a tabela de clientes
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY, -- ID único
    nome VARCHAR(100), -- Nome do cliente
    telefone VARCHAR(20), -- Telefone do cliente
    email VARCHAR(100), -- Email do cliente
    observacoes TEXT -- Observações sobre o cliente
);

-- Cria a tabela de serviços
CREATE TABLE servicos (
    id INT AUTO_INCREMENT PRIMARY KEY, -- ID único
    nome VARCHAR(100), -- Nome do serviço
    duracao INT, -- Duração do serviço (minutos)
    preco DECIMAL(10,2) -- Preço do serviço
);

-- Cria a tabela de agendamentos
CREATE TABLE agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY, -- ID único
    cliente_id INT, -- ID do cliente
    servico_id INT, -- ID do serviço
    data DATE, -- Data do agendamento
    hora TIME, -- Hora do agendamento
    observacoes TEXT, -- Observações sobre o agendamento
    FOREIGN KEY (cliente_id) REFERENCES clientes(id), -- Chave estrangeira para clientes
    FOREIGN KEY (servico_id) REFERENCES servicos(id) -- Chave estrangeira para serviços
);

-- Insere tipos de massagem de exemplo
INSERT INTO servicos (nome, duracao, preco) VALUES
('Massagem Relaxante', 60, 120.00),
('Massagem Sueca', 50, 110.00),
('Massagem Shiatsu', 45, 100.00),
('Drenagem Linfática', 75, 150.00),
('Massagem Modeladora', 60, 130.00);
