# Notas

**Projeto**: FieldOps  
**Candidato:** Thomás D'Angelo de Almeida Gomes  
**Objetivo:** Registro de decisões, trade-offs e justificativas técnicas do desafio prático, diferenciando o que foi de fato entregue na V1 do que é visão de evolução.

---

## 1. Decisões Arquiteturais e Técnicas

### Backend: FastAPI com SQLAlchemy 2.0 (Async) e Alembic

- **Decisão:** Utilização do FastAPI em vez de um framework síncrono tradicional (como Django) para o motor de API do FieldOps, combinando SQLAlchemy 2.0 Async e Alembic.
- **Porquê:**  
  O perfil esperado de tráfego é de picos de concorrência quando técnicos recuperam o sinal e disparam sincronizações em lote. Um stack baseado em ASGI (`asyncio`) e driver assíncrono (`asyncpg`) permite que uma única instância manipule muitas conexões concorrentes com uso de memória previsível.  
  A tipagem com Pydantic v2 oferece validação de payloads vinda do front, transformando entradas malformadas em respostas `422 Unprocessable Entity` em vez de erros 500.

- **Estado na V1:**  
  A V1 já utiliza FastAPI assíncrono, SQLAlchemy 2.0 Async, migrations via Alembic e validação de schemas com Pydantic. O desenho foi feito para que adicionar mais endpoints e regras de negócio não exija refactors estruturais.

---

### Multi-Tenancy: Schema Único com Discriminator (`company_id`)

- **Decisão:** Isolamento lógico entre empresas via coluna `company_id` em todas as tabelas centrais (users, visits, events, attachments), com índices compostos e injeção desse tenant via dependência global.
- **Porquê:**  
  Com um cenário inicial de ~50 empresas e crescimento projetado de 10x, modelos de “um banco por tenant” ou “um schema por tenant” trariam custo de infra e manutenção elevados (múltiplas instâncias/cluster, migrações complexas).  
  Um único schema com `company_id` como discriminador é suficiente desde que:
  - as queries sejam pensadas com índices compostos (ex.: `company_id + status + scheduled_at`),
  - e o backend nunca busque dados sem aplicar o filtro de tenant.

- **Mitigação de risco:**  
  Dependências do FastAPI extraem `company_id` do JWT e injetam esse filtro na camada de acesso a dados, reduzindo o risco de cross-tenant por esquecimento de `WHERE`.

- **Estado na V1:**  
  A V1 já aplica `company_id` em todas as entidades principais e usa o token JWT como fonte de verdade para isolamento.

---

### Upload de Mídias: V1 em Disco Local, Visão Alvo com Presigned URLs

- **Decisão arquitetural (visão alvo):**  
  O upload de fotos deve, no futuro, ser feito diretamente para um object storage (MinIO/S3) via URLs pré-assinadas, com a API atuando apenas como emissora de autorização temporária e não como pipeline de binário.

- **Porquê:**  
  Com uma projeção de até 30.000 visitas/dia e até 20 fotos de 5 MB por visita, o tráfego bruto pode chegar a terabytes diários. Se todo esse volume passasse pela API Python:
  - os workers de rede seriam consumidos por streaming de arquivos,
  - o TTFB de rotas administrativas degradaria,
  - e o custo de banda/infra cresceria sem necessidade.

- **Implementação na V1 (desafio prático):**  
  Para simplificar o ambiente do avaliador e evitar múltiplos serviços externos:
  - o upload é feito via endpoints FastAPI que recebem `UploadFile`,
  - os arquivos são gravados em **disco local** em um diretório dedicado,
  - o backend expõe essas imagens via rota estática (`/static/...`),
  - o banco guarda apenas o campo `file_url` na tabela `visit_attachments`.

- **Motivo do recorte:**  
  Essa abordagem mantém o contrato de API e o modelo de dados prontos para futura troca de backend de storage, ao mesmo tempo em que reduz o número de componentes que o avaliador precisa subir na máquina local.

---

### Estratégia Offline no PWA: Fila de Comandos Append-Only

- **Decisão arquitetural:**  
  Em vez de aplicar diretamente as mudanças de estado em um “espelho local” da visita, o PWA gera **comandos** (eventos) e coloca esses comandos em uma fila append-only, preservando a ordem cronológica.

- **Porquê:**  
  - Estratégias ingênuas de “last-write-wins” são perigosas em cenários de cancelamento e faturamento.
  - Uma fila de comandos com `idempotency_key` permite ao backend reproduzir exatamente a sequência de ações do técnico no momento da sincronização, facilitando auditoria e resolução de conflitos.

- **Visão alvo (storage da fila):**  
  Essa fila seria mantida em IndexedDB, por:
  - suportar volumes maiores que `localStorage`,
  - ser assíncrono e transacional,
  - permitir armazenar também referências a blobs de imagem.

- **Implementação na V1:**  
  - A fila de comandos foi implementada usando **`localStorage`**, indexada por usuário.
  - Cada comando contém informações como `visit_id`, `event_type`, `status_to_apply`, `idempotency_key` e timestamps.
  - Ao voltar online, o PWA percorre essa fila e envia:
    - eventos de status para a rota `/api/v1/sync`,
    - anexos/fotos para o endpoint de anexos.
  - O backend usa `idempotency_key` para evitar duplicações.

- **Motivo do recorte:**  
  IndexedDB + Background Sync demandariam mais tempo e infraestrutura no front; para o desafio, ficou priorizado entregar uma fila confiável e audível, ainda que em `localStorage`, com formato de mensagem já compatível com a futura migração.

---

### Infraestrutura Local e Portabilidade: Docker Compose

- **Decisão:** Orquestrar todos os componentes necessários ao desafio via `docker-compose.yml`.
- **Porquê:**
  - Atender à exigência de subir o sistema em menos de 10 minutos em uma máquina limpa.
  - Evitar a clássica situação de “na minha máquina funciona”.
  - Permitir que avaliadores não precisem instalar Python, Node, Postgres ou outras dependências; um comando `docker compose up --build` sobe toda a stack.

- **Estado na V1:**  
  O `docker-compose.yml` sobe backend, banco, frontends (Admin/PWA) e quaisquer serviços auxiliares necessários à demonstração. Componentes mais avançados (Redis, MinIO, etc.) permanecem como visão futura e não são obrigatórios para a execução da avaliação.

---

### Modelo Híbrido de Banco e Mensageria: Visão Alvo com PostgreSQL + Redis

- **Decisão arquitetural (visão alvo):**  
  - PostgreSQL como banco relacional principal.
  - Redis como fila em memória e/ou cache, para isolar tarefas de background da thread de requisição principal da API.

- **Porquê:**  
  - Isolar envios de webhooks, notificações e outras tarefas pesadas do caminho crítico da API.
  - Manter o TTFB baixo, mesmo com alto volume de sincronizações simultâneas.

- **Implementação na V1:**  
  - Apenas PostgreSQL está em uso.
  - Redis e workers de background ainda não foram introduzidos no desafio prático; o documento de arquitetura descreve a evolução planejada para quando integrações externas e notificações forem de fato necessárias.

---

### Estratégia de Notificações: Mock Local (Custo Zero)

- **Decisão:** Tratar notificações (WhatsApp/SMS/ERP) como _mock_ em ambiente local.
- **Porquê:**  
  - O projeto precisa ser 100% gratuito e executável localmente durante a avaliação.
  - Contratar gateways reais (Twilio, etc.) não é viável e fugiria do escopo.

- **Estado na V1:**  
  - A camada de notificações ainda não é exercitada por funcionalidades da interface.
  - A arquitetura já prevê pontos de extensão (por exemplo, após conclusão de visita), onde no futuro serão disparados jobs de notificação, seja via logs estruturados, seja via fila.

---

## 2. Alternativas Consideradas e Descartadas

### Django Admin para Painel de Backoffice

- **Alternativa:** Usar Django + Django Admin para construir rapidamente o painel administrativo.
- **Por que foi descartada:**  
  - O FieldOps demanda um painel mais rico em UX (timeline de eventos, visualização compatível com o PWA, dashboards) do que o Django Admin entrega por padrão.
  - Customizar profundamente o Django Admin com React moderno aumentaria o acoplamento e a complexidade, fugindo do objetivo de um backend stateless e genérico.
  - Separar API (FastAPI) e UI (React) simplifica tanto escalabilidade quanto experiência do usuário.

---

### Estratégia Offline Last-Write-Wins

- **Alternativa:** Aceitar sempre o “último write” vindo da nuvem ou do dispositivo, sem lógica de máquina de estados.
- **Por que foi descartada:**  
  - Cenários de conflito (admin cancela visita, técnico conclui offline depois) tornam essa estratégia perigosa, principalmente em contextos de SLA e faturamento.
  - Last-write-wins torna difícil auditar e justificar o estado final de uma visita.
- **Abordagem escolhida:**  
  - Centralizar inteligência de concorrência no backend.
  - Para transições ilegais, devolver `HTTP 409 Conflict` com o estado atual, permitindo ao PWA tratar o conflito de forma explícita.

---

## 3. Uso de Inteligência Artificial e Validação

Ferramentas de IA generativa foram utilizadas como **copiloto**, nunca como fonte final de verdade.

### Onde a IA foi aplicada

- **Boilerplates assíncronos:**  
  Apoio na configuração inicial de `AsyncSession`, `create_async_engine`, mapeamentos do SQLAlchemy 2.0 Async e uso correto de `asyncpg`.
- **Massa de dados de teste:**  
  Ajuda na geração de payloads complexos para sincronização em lote, CNPJs fictícios, UUIDs, datas e times para testes de integração.
- **Exploração de edge cases:**  
  Discussão arquitetural de cenários como:
  - “Admin cancela, técnico conclui offline”,
  - “Fila de sync muito grande depois de dias offline”.

### Como os resultados foram validados

Nenhuma sugestão de IA entrou no repositório sem passar por:

- **Validação estática:**  
  Ferramentas de linting/tipagem (por exemplo, mypy) e validação de schemas Pydantic.
- **Observação de queries SQL:**  
  Logs do SQLAlchemy foram revisados para identificar queries N+1, uso correto de transações e comportamento do pool de conexões.
- **Testes automatizados:**  
  Testes de integração e de unidade (quando presentes) foram usados como gate principal para garantir que a lógica de negócio se comportasse conforme o esperado.

---

## 4. Limitações Conhecidas da Solução

### 4.1 Idempotência sem Expiração

- **Problema:**  
  As `idempotency_key` armazenadas em `visit_events` não possuem política de expiração na V1.
- **Risco:**  
  Em produção, isso pode inflar a tabela desnecessariamente.
- **Direção futura:**  
  Mover o controle de idempotência recente para Redis com TTL (por exemplo, 24–48h) ou adotar rotinas periódicas de limpeza em banco.

---

### 4.2 Tamanho dos Lotes de Sync

- **Problema:**  
  A rota `/api/v1/sync` assume que o lote de eventos seja razoavelmente pequeno.
- **Risco:**  
  Um técnico muito tempo offline pode acumular um payload gigantesco, afetando latência e consumo de banda.
- **Direção futura:**  
  Implementar paginação da sincronização (por exemplo, enviar N eventos por requisição) e/ou compressão dos payloads.

---

### 4.3 Gestão de Segredos

- **Problema:**  
  Para facilitar a avaliação, credenciais estão em `.env` local.
- **Risco:**  
  Em produção, isso não é adequado.
- **Direção futura:**  
  Integrar com cofre de segredos (Secrets Manager, Vault etc.), evitando exposição de chaves e senhas em arquivos versionados ou em disco.

---

### 4.4 Sincronização de Dados do Servidor para o PWA

- **Problema:**  
  O foco atual está no caminho “PWA → servidor” (envio de eventos). A atualização “servidor → PWA” (novas visitas, alterações administrativas em tempo quase real) depende de refresh/polling simples.
- **Direção futura:**  
  Avaliar evolução para WebSockets, Server-Sent Events (SSE) ou polling mais inteligente, principalmente para o painel Admin acompanhar visitas em tempo quase real.

---

## 5. Perguntas para Stakeholders (Simulação de Projeto Real)

### Para Product Manager (PM)

- **Conflitos de status (409):**  
  “Quando houver conflito entre admin e técnico (por exemplo, admin cancela e técnico conclui offline), queremos:
  - apenas registrar o conflito como log de auditoria,
  - ou expor uma tela de conciliação manual no Admin para decidir se aquele serviço deve ser faturado mesmo assim?”

- **Política de fotos:**  
  “O limite de 20 fotos de 5 MB é um requisito real ou podemos reduzir resolução/tamanho no cliente sem impacto para auditoria? Há requisitos legais sobre retenção das fotos (por exemplo, quantos meses/anos)?”

### Para Tech Lead

- **Evolução do multi-tenant:**  
  “Caso surjam clientes Enterprise com volumetria muito superior, faz sentido migrar apenas esses clientes específicos para esquemas/bancos dedicados, mantendo pequenos e médios no schema compartilhado?”

- **Cache em leituras quentes:**  
  “Quais queries do Admin (por exemplo, listagem de visitas com filtros) justificam uma camada de cache via Redis? Qual política de invalidação faria sentido (por eventos, por tempo, por combinação)?”

### Para Time de SRE / Infraestrutura

- **Lifecycle de mídia:**  
  “Qual política de lifecycle queremos para fotos antigas: mover para cold storage após N dias, ou excluir definitivamente após o período de retenção legal?”

- **Escala automática:**  
  “Quais métricas queremos usar como gatilho de auto-scaling: CPU, tempo de resposta, número de conexões de banco, tamanho da fila de mensagens? Como isso conversa com picos previsíveis (por exemplo, fim de turno dos técnicos)?”
