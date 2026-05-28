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

Durante o desenvolvimento do MVP do FieldOps, ferramentas de Inteligência Artificial (LLMs) foram integradas de forma estratégica ao fluxo de trabalho do desenvolvedor, atuando estritamente como um acelerador de produtividade e co-piloto de engenharia, e não como gerador cego de código.

### Onde a IA foi Aplicada
* **Estruturação de Boilerplates Assíncronos:** Aceleração na escrita das configurações iniciais do SQLAlchemy 2.0 Async (`AsyncSession`, `create_async_engine`) e mapeamento declarativo dos enums do PostgreSQL.
* **Geração de Massa de Dados para Testes:** Auxílio na criação de payloads complexos de sincronização em lote e simulação de dados fictícios (CNPJs válidos, UUIDs e timestamps) para os testes do Pytest.
* **Desenho de Cenários Limítrofes (Edge Cases):** Discussão de abordagens arquiteturais para o tratamento do conflito concorrente "Admin cancela online vs. Técnico conclui offline", refinando os payloads de retorno da API.

### Como os Resultados foram Validados
Nenhum artefato gerado por IA foi integrado ao repositório sem validação rigorosa através de três camadas de checagem:
* **Validação Estática e Tipagem:** Varredura estática com `mypy` e verificação de schemas via Pydantic v2 para garantir que as estruturas de dados seguiam os padrões estritos do Python moderno.
* **Inspeção de Queries SQL (Logs do SQLAlchemy):** Monitoramento ativo do console do Docker para auditar se o SQLAlchemy estava executando os comandos assíncronos de forma otimizada (verificando a ocorrência de problemas como queries N+1 ou conexões presas).
* **Execução Verde da Suíte de Testes:** A validação definitiva deu-se através da execução com sucesso dos testes automatizados de integração, garantindo que o comportamento real do sistema condizia exatamente com as regras de negócio desenhadas.

---

## 4. Limitações Conhecidas da Solução

Como este projeto se trata de um MVP (Mínimo Produto Viável) focado em validar as premissas arquiteturais essenciais sob restrições de tempo, existem limitações conhecidas que necessitam de refinamento antes de uma promoção para ambiente produtivo de larga escala:

### Estratégia de Expiração de Chaves de Idempotência
Atualmente, as chaves de idempotência persistem por tempo indeterminado no banco. Em produção, isso causaria um inchaço desnecessário na tabela de eventos. O ideal seria mover o cache de chaves para o Redis com um TTL (Time-To-Live) estrito de 24 a 48 horas.

### Falta de Paginação Nativa no Sync de Lote
A rota `/api/v1/sync/` assume que o lote de eventos offline acumulado pelo dispositivo não ultrapassará limites razoáveis de payload de rede. Se um técnico passar semanas offline e gerar milhares de eventos, o payload de sincronização pode estourar o buffer da requisição, exigindo uma paginação de descarregamento na camada do PWA.

### Gerenciamento de Segredos (Secret Management)
Chaves de criptografia e credenciais de banco de dados estão parametrizadas diretamente no arquivo `.env` local do repositório para facilitar a execução imediata pelo avaliador. Em produção, esses dados devem ser extraídos e gerenciados por um cofre de segredos dedicado (AWS Secrets Manager, HashiCorp Vault ou GCP Secret Manager).

### Sincronização Unidirecional Abrangente
O PWA é excelente em enviar dados offline para o servidor (upload de eventos), mas a atualização contrária — puxar novas visitas atribuídas enquanto o aplicativo está aberto — depende de um refresh manual ou de um mecanismo de polling que precisa ser robustecido para WebSockets ou Server-Sent Events (SSE) para suportar tempo real estrito.

---

## 5. Perguntas para Stakeholders (Simulação de Projeto Real)

Se este MVP fosse o início de um desdobramento real em escala corporativa, as seguintes perguntas técnicas e de produto seriam direcionadas aos respectivos times para alinhar o roadmap:

### Perguntas para o Product Manager (PM)
* **Regra de Negócio Próxima ao Conflito:** "Quando houver um conflito onde o técnico conclui uma visita que já foi cancelada pela central, o sistema deve apenas registrar o log de auditoria ou devemos disponibilizar uma tela de conciliação manual no painel para o Admin decidir se aceita o faturamento do serviço prestado?"
* **Anexos e Custos:** "O limite de até 20 fotos de 5MB por visita é uma necessidade real de auditoria de campo ou podemos aplicar uma compressão agressiva de imagem no lado do cliente (PWA) antes do upload para reduzir drasticamente os custos de armazenamento e o consumo do plano de dados móveis do técnico?"

### Perguntas para o Tech Lead
* **Evolução do Multi-Tenancy:** "A projeção de crescimento de 10x (500 empresas) está confortável no isolamento lógico por linha, mas caso entrem clientes de nível Enterprise com volumetria massiva, podemos planejar uma migração híbrida onde esses clientes específicos ganham um Banco/Schema dedicado, mantendo os clientes de menor porte no Schema único?"
* **Estratégia de Cache:** "Devemos introduzir uma camada de cache via Redis à frente das consultas de listagem de visitas do painel Admin para mitigar consultas repetitivas ao PostgreSQL, estabelecendo uma política de invalidação baseada em eventos?"

### Perguntas para o Time de SRE / Infraestrutura
* **Políticas de TTL e Cold Storage:** "Para conter os custos do Object Storage (S3) com terabytes de fotos de visitas retroativas, podemos configurar uma regra de ciclo de vida (Lifecycle Policy) para mover imagens com mais de 90 dias automaticamente para classes de armazenamento mais baratas (como AWS Glacier)?"
* **Auto-Scaling Triggers:** "Dado o perfil de tráfego agressivo de sincronização simultânea ao fim do expediente dos técnicos, quais métricas devemos priorizar para os gatilhos de auto-scaling dos containers da API: uso de CPU/Memória ou contagem de conexões ativas no pool do banco de dados?"