# Notas
**Projeto**: FieldOps
**Candidato:** Thomás D'Angelo de Almeida Gomes
**Objetivo:** Registro de decisões, trade-offs e justificativas técnicas do desafio prático.

---

## 1. Decisões Arquiteturais e Técnicas

### Backend: FastAPI com SQLAlchemy 2.0 (Async) e Alembic
* **Decisão:** Utilização do FastAPI em detrimento do Django tradicional para o motor de API do FieldOps.
* **Porquê:** O perfil de tráfego do sistema é misto e agressivo, caracterizado por picos de concorrência quando os técnicos de campo recuperam o sinal celular e disparam sincronizações de lotes (*batch sync*) simultaneamente. O suporte nativo a `asyncio` do FastAPI permite que uma única instância gerencie milhares de conexões persistentes/concorrentes com baixo consumo de memória, otimizando o I/O bloqueante do banco de dados. A validação via Pydantic v2 garante que nenhum dado malformado vindo do IndexedDB estoure erros 500 no servidor, transformando falhas em respostas limpas do tipo `422 Unprocessable Entity`.

### Multi-Tenancy: Schema Único baseado em Discriminator (`company_id`)
* **Decisão:** Isolamento lógico na camada de dados utilizando a coluna `company_id` (Tenant) em todas as tabelas centrais do banco, indexada e injetada via dependência global do FastAPI.
* **Porquê:** Avaliando o cenário inicial de 50 empresas clientes e crescimento projetado de 10x (500 empresas), estratégias como Banco por Tenant ou Schema por Tenant (PostgreSQL Schemas) trariam um overhead proibitivo de infraestrutura (esgotamento de pools de conexão, alto custo de instâncias RDS e complexidade extrema para rodar migrações do Alembic em paralelo). O isolamento por linha atende perfeitamente à volumetria se combinado com índices compostos corretos. Para mitigar o risco técnico de vazamento de dados (*cross-tenant data leaks*), implementamos uma dependência no FastAPI que extrai o tenant do token JWT e injeta o filtro obrigatoriamente na camada de dados.

### Upload de Mídias: Upload Direto via URLs Pré-Assinadas (Presigned URLs)
* **Decisão:** O PWA solicita uma URL assinada temporária ao backend e realiza o upload da foto (máx 5MB) diretamente para o Object Storage (S3/MinIO), sem trafegar os bytes pelo servidor Python.
* **Porquê:** Considerando o teto dos requisitos (30.000 visitas/dia com até 20 fotos de 5MB), o tráfego potencial pode atingir 3TB de binários por dia. Se esse volume passasse pela API FastAPI, os workers de rede ficariam estrangulados processando streams de binários, inflando os custos de banda e gerando lentidão geral no painel administrativo. O backend atua estritamente como o autorizador da operação.

### Estratégia Offline no PWA: Fila de Comandos (Append-Only) no IndexedDB
* **Decisão:** As ações do técnico em modo offline não alteram diretamente um estado local espelhado. Em vez disso, geram comandos estruturados em uma fila Append-Only baseada em IndexedDB.
* **Porquê:** Mecanismos baseados em LocalStorage sofrem com o limite estrito de 5MB e falta de suporte a transações ACID locais. Usando uma fila FIFO (First-In, First-Out) isolada no IndexedDB, garantimos que a ordem cronológica das ações do técnico seja preservada e transmitida ao servidor exatamente como aconteceu no mundo físico, facilitando auditorias e tratamentos de erro de concorrência.

### Infraestrutura Local e Portabilidade: Docker Compose Obrigatório
* **Decisão:** Centralização de todo o ecossistema (Backend, Banco de Dados, Object Storage, Message Broker e Front-ends) em containers isolados via `docker-compose.yml`.
* **Porquê:** Para garantir o critério de aceitação estrito da prova ("rodar em menos de 10 minutos em uma máquina limpa"), o Docker elimina o problema clássico de incompatibilidade de ambiente ("na minha máquina funciona"). O avaliador ou o apresentador não precisa instalar Python, Node.js ou PostgreSQL localmente; um único comando `docker compose up --build` ergue a malha de microsserviços interconectados em redes internas isoladas.

### Modelo Híbrido de Banco e Mensageria: PostgreSQL 15 + Redis Queue
* **Decisão:** Uso do PostgreSQL 15 como SGBD relacional central e o Redis operando como banco em memória para gerenciamento de filas de segundo plano.
* **Porquê:** Isolar tarefas pesadas (como disparar notificações ou processar integrações) da thread principal da API FastAPI é vital para manter o TTFB abaixo de 200ms. O Redis armazena temporariamente os jobs em memória RAM com velocidade extrema, enquanto os Workers Python assíncronos consomem essa fila sem onerar ou travar o PostgreSQL, que fica livre estritamente para transações operacionais rígidas e seguras das visitas.

### Estratégia de Notificações Pragmática: Mock Local (Custo Zero)
* **Decisão:** Isolamento da camada de serviços de notificação (WhatsApp/SMS) utilizando um padrão de Simulação (Mock) baseado em logs estruturados no terminal do Worker.
* **Porquê:** Como o projeto deve ser 100% gratuito e executado localmente no dia da apresentação, a contratação de gateways de envio pagos (como Twilio) foi descartada. O código simula o disparo com sucesso registrando o payload final no console do container. Isso prova a arquitetura assíncrona desacoplada de ponta a ponta sem gerar custos financeiros reais para a avaliação do MVP.

---

## 2. Alternativas Consideradas e Descartadas

### Django Admin para Painel de Backoffice
* **Descartado:** Embora o Django Admin acelerasse a entrega das telas do operador, os requisitos de monitoramento de SLA em tempo real, dashboards dinâmicos de rotas e o desejo de compartilhar componentes de UI (como a timeline de eventos) com o PWA inviabilizaram a escolha. Customizar o Django Admin com componentes React modernos e layouts responsivos gera um acoplamento complexo e de difícil manutenção. Optou-se por separar a API (FastAPI) da interface (React + Vite).

### Estratégia Offline baseada em Last-Write-Wins
* **Descartada:** A abordagem onde "quem salva por último na nuvem ganha" causaria caos operacional. Se um técnico passa 4 horas offline em um subsolo, conclui o serviço, mas o operador administrativo havia cancelado aquela visita no painel há 2 horas (por desistência do cliente), aceitar a conclusão do técnico de forma cega sobrescreveria o status de cancelamento e corromperia as regras de faturamento do negócio. Escolheu-se delegar a decisão para uma máquina de estados explícita no servidor no momento da sincronização, devolvendo o status `409 Conflict` quando ilegal.

---

## 3. Uso de Inteligência Artificial e Validação

---

## 4. Limitações Conhecidas da Solução

---

## 5. Perguntas para Stakeholders (Simulação de Projeto Real)
