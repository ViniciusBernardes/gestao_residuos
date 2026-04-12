# Gestão de Resíduos — PoC SaaS multi-município

Sistema web para **gestão de resíduos recicláveis** com arquitetura **multi-tenant** (múltiplos municípios), alinhado a requisitos típicos de editais públicos: cadastros, estoque, saídas para destinação, rastreio, relatórios, auditoria (LGPD) e administração.

## Stack

| Camada    | Tecnologia                          |
|----------|--------------------------------------|
| Frontend | Next.js 15 (React), Tailwind        |
| Backend  | NestJS 10, REST, Swagger em `/api/docs` |
| Dados    | PostgreSQL + Prisma (migrations)    |
| Auth     | JWT + RBAC (`ADMIN`, `MANAGER`, `OPERATOR`) |
| DevOps   | Docker Compose (API, Web, Postgres, MinIO) |

## Estrutura do repositório

```
gestao_residuos/
├── backend/          # API NestJS + Prisma
├── frontend/         # Next.js (App Router)
├── docker-compose.yml
└── README.md
```

### Backend — módulos (DDD por domínio)

- `auth` — login com `tenantSlug` + e-mail/senha; auditoria de login
- `users`, `tenants` — usuários e contexto do município
- `material-types`, `units`, `materials`, `deposits`, `centers` — cadastros
- `stock` — entradas (coleta), transferências, saldos, movimentações
- `exits` — saídas para centros de reciclagem + valor financeiro
- `tracking` — linha do tempo por material
- `reports` — dashboard + exportação PDF/Excel
- `import` — importação CSV de materiais
- `audit` — consulta de logs de ações e logins
- `admin` — parâmetros (`SystemParameter`), relatórios personalizados (`CustomReport`), versão de schema
- `health` — `/api/health` para load balancer / Kubernetes

Camada interna: controllers finos, services com regras, Prisma como persistência (padrão repository via `PrismaService`).

## Execução local (desenvolvimento)

### 1. Banco de dados

Suba o PostgreSQL (porta `5432`) ou use apenas o serviço `postgres` do Docker Compose.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Ajuste DATABASE_URL e JWT_SECRET

npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

- API: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/api/docs`

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local

npm install
npm run dev
```

- App: `http://localhost:3000`

### Credenciais de demonstração (seed)

| Campo        | Valor              |
|-------------|--------------------|
| Tenant slug | `demo-municipio`   |
| E-mail      | `admin@demo.local` |
| Senha       | `Admin@123`        |

## Docker Compose

Na raiz do projeto:

```bash
docker compose up -d --build postgres minio api web
```

- Postgres: `localhost:5432`
- API: `localhost:3001`
- Web: `localhost:3000`
- MinIO (S3 compatível): API `9000`, console `9001` (usuário/senha no `docker-compose.yml`)

Após o primeiro start, execute o seed **uma vez** (com o container `api` rodando e banco migrado):

```bash
docker compose exec api npx prisma db seed
```

## Requisitos não funcionais (orientação para produção)

- **Disponibilidade / HA**: API stateless atrás de load balancer; Postgres em modo gerenciado com réplicas; health checks em `/api/health`.
- **Backup**: snapshots automáticos do RDS/Cloud SQL + retenção; testes de restore.
- **Escalabilidade horizontal**: múltiplas réplicas da API; filas (ex.: SQS) para importações grandes.
- **Monitoramento**: agregação de logs (JSON) + métricas (Prometheus/OpenTelemetry); alarmes em erros 5xx e latência.
- **LGPD**: `AuditLog` e `LoginAuditLog`; políticas de retenção; minimização de dados em logs.
- **Armazenamento S3**: serviço `StorageService` (stub) preparado para troca por `@aws-sdk/client-s3` ou MinIO.

## Exportações e importação

- **PDF / Excel**: rotas `GET /api/reports/export/stock.pdf` e `.../movements.xlsx` (JWT).
- **CSV**: `POST /api/import/materials/csv` com corpo `{ "csv": "..." }` (colunas aceitas: `name` / `nome`, `code` / `codigo`, etc.).

## Evolução e versionamento

- **Schema**: migrations Prisma em `backend/prisma/migrations`.
- **Parametrizações**: tabela `SystemParameter` (JSON versionado por chave).
- **Versão aplicada por tenant**: `SchemaVersion`.

## Licença

Projeto de referência / PoC — adapte licença e termos ao órgão contratante.
# gestao_residuos
