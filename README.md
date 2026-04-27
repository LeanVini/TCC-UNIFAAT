=======
# TCC - Sistema de Agendamentos de Massagem

## Backend Completo 

### 🚀 Rodar com Docker (Recomendado)
```bash
cd TCC--main
docker compose up -d --build
```
- **Frontend + API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health 
- **MySQL**: localhost:3307 | root/password | DB: agenda_massagem
- **Logs**: `docker compose logs -f backend`

### Estrutura
```
TCC--main/
├── backend/          # Node.js/Express API
│   ├── server.js     # API completa (CRUD clientes/agendamentos/servicos)
│   ├── package.json
│   ├── Dockerfile
│   └── .env
├── database/         # schema.sql (auto-init)
├── frontend/         # HTML/JS/CSS (agora usa API real)
└── docker-compose.yml
```

### API Endpoints
- `GET /api/clientes` - Lista clientes
- `POST /api/clientes` - Criar cliente
- `GET/POST/PUT/DELETE /api/agendamentos/:id` - Agendamentos c/ new client inline
- `GET /api/servicos` - Tipos de massagem

**Features**: Validations, joins, transactions, connection pool, CORS, health checks.

### Desenvolvimento Local (sem Docker)
```bash
cd backend
npm install
# Crie DB local + rode database/schema.sql
npm start
```

## Próximos passos (Frontend)
- Migrar localStorage para /api/clientes no clientes.js
- UI melhorias

=======
# TCC-

