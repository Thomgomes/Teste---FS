# FieldOps

Plataforma para gestão de equipes de campo, conectando:

- **Operadores administrativos** (painel Web Admin).
- **Técnicos de campo** (app PWA instalável, com suporte a offline e sincronização).
- **Clientes finais** (página pública de acompanhamento da visita, sem login).

Este repositório entrega uma fatia vertical funcional do FieldOps, cobrindo o fluxo:

> Admin agenda visita → Técnico executa (inclusive offline) → Cliente acompanha via link público.

***

## Stack utilizada

| Camada | Tecnologia |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.0 Async, Alembic |
| Banco de dados | PostgreSQL 15 |
| Storage de arquivos | Sistema de arquivos local (`uploaded_images` servida via FastAPI) |
| Frontend Admin | React + Vite + Tailwind |
| Frontend PWA | React + Vite + Tailwind |
| Infra local | Docker Compose |

***

## Pré-requisitos

Você precisa ter instalado:

- [Docker](https://docs.docker.com/get-docker/)
- Docker Compose (ou Docker Desktop com Compose integrado)

> **Não é necessário** instalar Python, Node.js ou PostgreSQL diretamente na máquina.

***

## Serviços da stack

O arquivo `docker-compose.yml` sobe os seguintes serviços:

| Serviço | Descrição | Porta |
|---|---|---|
| `db` | PostgreSQL 15 | 5432 |
| `backend` | API FastAPI | 8000 |
| `frontend-admin` | Painel administrativo | 3000 |
| `frontend-pwa` | PWA do técnico | 3001 |

### Portas expostas

- **Backend:** http://localhost:8000
- **API:** http://localhost:8000/docs
- **Admin:** http://localhost:3000
- **PWA:** http://localhost:3001
- **PostgreSQL:** localhost:5432

***

## Como subir o ambiente

Na pasta `fieldops/`, execute:

```bash
docker compose up --build
```

Na primeira execução, o comando vai:

1. Baixar as imagens base
2. Instalar dependências do backend e dos frontends
3. Rodar as migrations do Alembic
4. Aplicar seeds iniciais (empresa, usuários e visitas)
5. Subir o backend e os dois frontends

Quando o comando terminar de subir os serviços, você pode acessar:

- **Painel Admin:** http://localhost:3000
- **PWA do técnico:** http://localhost:3001
- **Swagger do backend:** http://localhost:8000/docs

### Derrubar os containers

```bash
docker compose down
```

### Reset completo (apaga dados persistidos)

```bash
docker compose down -v
```

***

## Dados seed e credenciais de teste

Ao subir a stack pela primeira vez, o backend:

- aplica as migrations,
- injeta uma empresa piloto,
- cria usuários e visitas,
- **apenas se o banco estiver vazio**.

### Usuários padrão

| Perfil | Email | Senha |
|---|---|---|
| Mesa Operacional (Admin) | admin@fieldops.com.br | `admin123` |
| Técnico 1 | tech@fieldops.com.br | `tech123` |
| Técnico 2 | tech2@fieldops.com.br | `tech123` |

### Resetar banco e reaplicar seeds

```bash
docker compose down -v
docker compose up --build
```

***

## Upload de fotos e armazenamento

Na V1 local, os uploads de fotos:

- são recebidos pelo backend FastAPI;
- são salvos em uma pasta local persistida (`backend/uploaded_images` / `backend/app/static/uploads`);
- são servidos como arquivos estáticos via backend, gerando URLs no formato:

```
http://localhost:8000/static/uploads/<nome-do-arquivo>.jpg
```

O frontend consome essas URLs para exibir as fotos na timeline da visita.

***

## Fluxo principal de demonstração

Este é o fluxo que a banca avaliadora pode seguir para validar o desafio prático.

### 1. Criar e gerenciar visitas no Admin

1. Acesse http://localhost:3000.
2. Faça login com o usuário admin `admin@fieldops.com.br`.
3. Crie uma nova visita para um dos técnicos (ou use uma das visitas seed).
4. Use a tela de listagem para filtrar por: data, técnico, status.

### 2. Técnico visualiza visitas no PWA

1. Acesse http://localhost:3001.
2. Faça login com `tech@fieldops.com.br` ou `tech2@fieldops.com.br`.
3. Confira a lista de "minhas visitas do dia".
4. Verifique que as visitas criadas no Admin aparecem na agenda do técnico.

### 3. Operação offline

Com o PWA aberto, desligue a rede pelo DevTools (modo offline). No PWA:

1. Selecione uma visita.
2. Clique em **"Iniciar visita"**.
3. Registre observações e/ou tire uma foto (upload ficará em fila).
4. Clique em **"Concluir visita"**.

Observe:
- a fila local de eventos pendentes;
- o indicador visual de que a visita ainda não foi sincronizada.

### 4. Retorno da conectividade e sincronização

1. Reative a rede no DevTools.
2. Aguarde o PWA detectar que voltou a ficar online.
3. A fila local de eventos será enviada para o backend:
   - o endpoint `/api/v1/sync` processa o lote usando `idempotency_key` para evitar duplicações;
   - o backend aplica a máquina de estados da visita;
   - anexos são associados à visita.
4. Confirme:
   - no Admin, a visita aparece com o novo status (por exemplo, `CONCLUIDA`);
   - no PWA, o status é atualizado;
   - a fila de sincronização fica vazia (ou mostra as pendências em conflito, se houver).

### 5. Página pública do cliente

1. No Admin (ou backend), obtenha o `public_token` da visita (ou use uma rota/teste preparado para isso).
2. Acesse a URL pública no formato:

```
http://localhost:8000/v/<token>
```

ou, se estiver servida pelo frontend:

```
http://localhost:3000/v/<token>
```

3. Verifique que:
   - a página mostra o status atual da visita;
   - traz o técnico designado e a janela prevista;
   - **não exibe dados sensíveis** (sem CPF, telefone ou dados de contato completos).

***

## Testes automatizados

Os testes automatizados de backend podem ser executados com:

```bash
docker compose exec backend pytest tests/ -v
```

Eles cobrem os principais caminhos críticos:

- autenticação,
- criação e atualização de visitas,
- fluxo de sincronização `/api/v1/sync`,
- tratamento de `idempotency_key`,
- cenários de conflito básico.

> Se houver testes adicionais no futuro (por exemplo, front-end), eles podem ser documentados aqui.

***

## Comandos úteis de Docker

```bash
# Subir a stack
docker compose up --build

# Subir em background
docker compose up --build -d

# Ver logs de todos os serviços
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f backend
docker compose logs -f frontend-admin
docker compose logs -f frontend-pwa

# Derrubar containers
docker compose down

# Derrubar containers e volumes (reset de banco e uploads)
docker compose down -v
```

***

## Observação sobre a prova

Esta implementação foi construída especificamente para o teste FieldOps, com foco em:

- entregar uma fatia vertical funcional (Admin → Técnico → Cliente final),
- demonstrar a exequibilidade da arquitetura proposta,
- e atender ao requisito de subir a stack em uma máquina limpa, em menos de 10 minutos, seguindo apenas este README.