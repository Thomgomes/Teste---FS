# Parte 2 — Questões técnicas curtas

Responda objetivamente.
Espera-se entre 10 e 20 linhas por questão. Pode usar IA, mas escreva com suas palavras.

***

## Bloco A — Frontend e React

### Questão 1. Estado em uma aplicação React grande

Em uma SPA React com dezenas de telas, qual sua estratégia para gerenciar:

- Estado de servidor (dados que vêm da API).
- Estado de UI (modais abertos, formulários, filtros).
- Estado global (usuário logado, tema, permissões).

Que ferramentas escolheria e por quê? O que evitaria? Em que momento usar Context é uma má ideia?

#### Resposta Questão 1:

- Estado de servidor: Normalmente em dados que vem da API eu constumo utilizar o hook useEffect para disparar a chamada da API,e o resultado é salvo em um useState local, porém dessa forma tem que tratas de erros, cache e estados de loading, então em caso de um SPA com dezenas de telas acredito que seria melhor utilizar p TanStack Query. já que ele elimina a necessidade da logica do refresh.

- Estado de UI: para controle de modais, forms e abas é bom manter o estado local, podendo variar entre Formik ou Zustand dependendo das outras bibliotecas presente no projeto, evitando um pesos e re-renderizações desnecessárias em componentes que não precisam dessa interface.

- Estado Global: Eu gosto de fazer Providers para esse caso, por exemplo um authProvider que vai gerenciar e compartilhar o estado de login de um usuario em toda a aplicação sem a necessidade de passar os dados entre varios componentes.

Eu evito de centralizar dados de formularios ou estados que mudam frequentimente em contextos globais, Usar Context APi para dados que se mutam diversas vezes é um ideia ruim, pois ela vai forçar a re-renderização de todos os componentes que consomem aquele contexto, fazendo com que puxe dados simultaneamente e pesa e pode levar ao desgaste do processamento para uma função desnecessaria.

### Questão 2. Performance em React

Liste 5 causas comuns de lentidão em uma aplicação React e como diagnosticaria cada uma (ferramentas, métricas). Para 2 dessas causas, descreva a correção com nível de detalhe técnico (qual API, qual hook, qual padrão).

#### Resposta Questão 2:

Re-renderização descenessárias por conta de props passadas para filhos. Diagnosticado via React DevTools Profiller observando commits .
Lista de grandes renderizações de uma só vez, como tables e grids com muitos items sem uma "paginação" para limitar os dados puxados, ainda mais se elas forem vinda de API diferentes ou de dados com filtros errados dentro da API. uso de CPU no DevTools.
Mal uso de renders, podem ser payload grande ou uma função mal escrita para puxar dados da API a tanto segundo de forma desorganizada pode pesar muito o sistema, Medindo com logs para evitar o processo.
Recriar funções passadas como propriedades de pai para filhos, querbando assim o cache. forma de resolver: Envolver as funções em hooks "useCallback"
Tamanho excessivo do bundle fazendo com que carregue tudo em uma unica chunk. diagnóstico aba de network.

Correção de 2 causas:

Re-renderização descenessárias. Em compoentes que recebem props estáveis podemos usar useMemo para estabilizar fazendo com que os dados não mudem a cada render.

Lista Grandes. usar um react-window ou alguma outra biblioteca de paginação para que seja renderizado e puxado apenas uma pequena parcela daquela lista.

### Questão 3. Acessibilidade

Cite 4 práticas de acessibilidade que você considera não-negociáveis em uma aplicação web profissional e explique por quê. Inclua ao menos uma específica para formulários e uma específica para componentes interativos customizados (ex.: dropdown, modal).

#### Resposta Questão 3:

Um Bom SEO garante que  leitores de tela e navegação por teclado funcionem, além de otimizar as buscar relacionadas.

Toda funcionalidade precisa ser acessível via teclado, fazendo com que tanto o UI quanto o UX cooperem para fazer com que o usuario consiga operar por exemplo um formulário com o teclado de forma acessivel.

Formularios e labels com mensagens claras, como por exemplo "Email inválido" "A senha precisa de pelo menos 8 digitos contendo 1 maiusculo,1 numero e 1 simbolo." ao inves de " Erro " ou " senha no modelo errado "

Componente interativo costumizado bem anunciados, por exemplo dropdown com setas visiveis e claras para o usuario ha saber a direção, modais com botões de fechar claros.

***

## Bloco B — Backend Python

### Questão 4. Django vs. FastAPI — decisão prática

Para uma API REST + fila de jobs em segundo plano + admin web interno, qual você escolheria e por quê? Dê 2 cenários em que mudaria de ideia. Cite trade-offs concretos (ecossistema, ORM, async, validação, manutenção, time-to-market).

#### Resposta Questão 4:

Para esse cenário especifico ( API REST...) eu escolheria FastAPI pois o ecossistema do Django é sincrono que exige maior consumo de memória e instâncias para lidar com muitas requisições concoteentes de assincronidade. já o FastAPI funciona de forma nativa como assincrono, permitindo gerencias conexões I/O-bound pesadas de forma eficiente.

mudaria para django se o time inteiro fosse composto por desenvolvedores especialistas em Django.

e se o escopo do painel administrativo interno exigisse customizações complexas de permissões estruturadas, relatórios e auditorias brutas onde o Sjango Admin aceleraria o projeto, assim eliminando a necessidade de construir do zero.

### Questão 5. Concorrência e Python

Explique a diferença prática entre I/O-bound e CPU-bound em Python. Em qual situação você usaria asyncio, threads, multiprocessing e Celery (ou equivalente)? Dê um exemplo concreto para cada um e diga o que acontece se você errar a escolha (ex.: usar asyncio para CPU-bound).

#### Resposta Questão 5:

A diferença entre eles é que o I/O-bound gasta grande parte do tempo esperando respostas externas ( consultas do banco, chamadas de API), enquanto operações CPU-Bound exigem um processamenteo matemático e computacional intenso do processador ( criptografia, compressão de imagens, parsing de arquivos grandes).

asyncio usaria para gerenciar milhares de conexões simultâneas na API.

threads usaria para operações I/O-bound em bibliotecas legadas qie não dão suporte a async/await.

multprocessing usaria para tarefas CPU-Bound locais, criando assim novos processos no sistema operacional, contronando o Gil e distribuindo a carga em multiplos núcleos da CPU

Celery usaria como um executor de taregas distribuídas fora da API, enfileirando tarefas pesadas em instancias separadas.

Se errar usando asyncio para uma tarefa de CPU-bound travaria o loop de eventos fazendo a API travar e parar de responder a qualquer outra requisisão de rede enquanto aquela compactação não terminasse.

### Questão 6. Migrations e zero-downtime

Descreva como você faria uma migração de schema com zero downtime em um banco em produção. Use como exemplo: renomear uma coluna `usuario` para `usuario_id` em uma tabela com 200 milhões de linhas. Quantos deploys são necessários? Qual a ordem das mudanças entre código e banco?

#### Resposta Questão 6:

Eu faria várias etapas e múltiplos deploys, sempre mantendo compartibilidade entre cada versão do código e do schema.

1 deploy executeria uma migração para adicionar uma coluna usuario_id sem remover usuario. em backgronund, copiaria os valores de usuario para usuario_id em batches pequenas para não pegar muito processamento do banco evitando com que ele caia. e no codigo continua lendo usuario.

2 deploy o back passa a ler usuario_is como fonte principal em fallback lê usuario caso o usaurio_id esteja nulo.

3 deploy removo a coluna antiga de usuario ( quanto todos os registros tiverem em usuario_id )e assim o codigo não vai mais utilizar usuario.

***

## Bloco C — Arquitetura e sistemas distribuídos

### Questão 7. REST, GraphQL ou RPC

Você está desenhando a API para um sistema com clientes muito diferentes (admin web pesado, PWA mobile com offline, parceiros B2B via integração). Quando escolheria REST, GraphQL ou tRPC/gRPC? Pode usar mais de uma na mesma plataforma? Como evitaria que a API vire um "buffet" inconsistente?

#### Resposta Questão 7:

Para uma plataforma de múltiplos clientes, adoto uma estratégia híbrida focada em contratos bem estabelecidos. Escolheria REST (JSON) para as integrações com parceiros B2B (padrão de mercado, fácil adoção e excelente suporte a HTTP Caching) e para a sincronização em lote do PWA mobile. O GraphQL seria uma alternativa excelente para o Admin Web Pesado, permitindo que a tela busque dashboards complexos, SLAs e dados agregados em uma única requisição, evitando o problema de Over-fetching (trazer dados que a tela não usa). O gRPC/tRPC seria reservado para a comunicação interna de microsserviços (se houver no futuro), dada a sua performance baseada em Protocol Buffers sobre HTTP/2.

ara evitar que a API se torne uma colcha de retalhos, implemento o padrão BFF (Backend-For-Frontend). A API principal (Core) permanece estritamente REST e padronizada. Criamos uma camada fina de BFF para o Admin Web (que expõe um endpoint GraphQL) e um BFF para o PWA. O BFF consome a API REST principal e formata os dados conforme a necessidade específica de cada cliente, mantendo o núcleo do backend limpo e consistente.

### Questão 8. Idempotência e consistência

- O que é uma operação idempotente? Dê um exemplo de POST que precisa ser idempotente e descreva como tornaria assim (chave de idempotência, deduplicação).
- Quando você aceitaria consistência eventual em vez de forte? Dê um caso concreto.
- O que é o problema do "dual write" e como você o resolveria (outbox pattern, CDC, transações)?

#### Resposta Questão 8:

Operação idempotente é aquela que ao ser aplicada várias vezes com o mesmo input, produz o mesmo efeito.

Exemplo de POST que precisa ser idempotente: POST /api/v1/sync do PWA, que recebe um lote de eventos de visita. Se o PWA re-enviar o mesmo lote por causa de timeout, o servidor não pode duplicar os eventos. Para tornar idempotente: o cliente envia uma idempotency_key (UUID) por comando; o backend registra essa chave junto com o resultado. Se receber novamente a mesma chave, retorna o mesmo resultado e ignora a duplicação (ou marca como já processado).

Aceitaria na atualização da timeline pública do cliente final e na geração de relatórios administrativos de fechamento de mês. Não há necessidade de consistência forte (paralisar o banco para garantir a escrita imediata) nesses painéis, permitindo um atraso de alguns segundos/minutos em prol de maior vazão de escrita no sistema.

Problema do dual write é quando um serviço escreve em dois sistemas diferentes (por exemplo, banco relacional e fila para analytics) em passos separados: se um succeed e o outro não, há divergência. Para resolver, uso outbox pattern: transação única no banco grava tanto o evento principal quanto um registro de “outbox” em uma tabela. um worker lê essa tabela e publica eventos confiáveis em outra fila/sistema. Com CDC (Change Data Capture), outra opção é ouvir logs do banco e replicar eventos consistentemente, sem depender de writes duplicados no app.

### Questão 9. Cache

Em quais camadas você consideraria cache (CDN, edge, aplicação, banco)? Para cada uma, dê um exemplo de uso, política de invalidação e um cenário em que cache nessa camada machuca mais do que ajuda.

#### Resposta Questão 9:

CDN / Edge: servir assets estáticos (JS/CSS, imagens) e páginas públicas (/v/`<token>`) com TTL curto. Invalidação: baseado em versão (hash em arquivo, Cache-Control com immutable). Risco: baseado em versão (hash em arquivo, Cache-Control com immutable).

Na borda da aplicação, via reverse proxy ou gateway, faz sentido cachear respostas de GET públicos ou semiss estáticos, como configurações por tenant ou listas de referência usadas com frequência. A invalidação pode ser por tempo (TTL controlado) ou por eventos (por exemplo, apagar uma chave específica quando alguém altera uma configuração). O problema aqui é quando a aplicação depende de ver o estado em tempo quase real e alguém adiciona cache sem combinar com o produto: o usuários passa a ver dados atrasados, o que “machuca” mais do que ajuda.

Na camada de aplicação, geralmente em Redis, eu usaria cache para evitar consultas repetitivas e caras, como leitura de configurações de tenants, listas de usuários ativos, ou resultados de queries de relatórios. A invalidação precisa ser bem pensada: ou por tempo (EXPIRE) ou dirigida por eventos de escrita (por exemplo, limpar o cache quando uma visita muda de estado). Se o time cachear dados voláteis, como status de visita, sem invalidar, é fácil cair em bugs intermitentes onde a API retorna um estado e o banco outro.

No banco, o “cache” aparece em forma de materialized views, índices e mecanismos internos de otimização. Isso pode ajudar para relatórios pesados, mas exige processos de refresh bem planejados para que os dados não fiquem defasados demais. Quando mal usado, esse tipo de cache faz o time acreditar que está lendo “verdade” quando, na prática, está olhando um snapshot desatualizado. Em resumo, cache é poderoso para leitura intensiva de dados que mudam pouco, mas se torna nocivo quando é aplicado em dados críticos sem uma política de invalidação clara, testada e documentada.

***

## Bloco D — Mobile-web e PWA

### Questão 10. Limites da PWA

Em comparação com um app nativo (ou React Native), o que uma PWA faz bem, faz mal, ou não faz no iOS e Android em 2026? Cite ao menos:

- Notificações push.
- Acesso a câmera e arquivos.
- Background sync.
- Instalação e descoberta.

Em que cenário você defenderia recomeçar como nativo/RN? Em qual a PWA é a melhor escolha?

#### Resposta Questão 10:

Hoje PWA já é bem madura, mas ainda não é tão bom comparando com app nativo ou React Native. Em notificações push, no Android o Web Push funciona direitinho; no iOS ainda tem mais atrito, precisa instalar na home e as permissões são mais chatinhas, então a adesão costuma ser menor. Em acesso à câmera e arquivos, pro tipo de app do FieldOps a PWA atende bem: com getUserMedia e input de arquivo dá pra tirar foto, anexar e mandar pro backend sem drama. Onde ela começa a sofrer é em background sync: no Android dá pra agendar sync quando a rede volta e o sistema colabora; no iOS o sistema mata o processo em segundo plano bem mais agressivo, então a previsibilidade é mais baixa do que em app nativo. Em instalação e descoberta, PWA ganha em simplicidade, você publica, o usuário acessa a URL e instala, mas perde a vitrine da App Store/Play Store. Eu defenderia migrar pra nativo/RN se o produto dependesse muito de recursos como rastreamento de localização em background por horas, mesmo com o celular bloqueado, ou se a gente tivesse que falar com hardware específico (Bluetooth, NFC, etc.). Pro FieldOps, no recorte da prova, PWA fecha bem a conta: resolve offline, reduz custo de stack e evita manter duas bases de código mobile.

### Questão 11. Service Worker

Explique o ciclo de vida de um Service Worker (instalação, ativação, atualização) e as armadilhas mais comuns:

- O famoso "app que não atualiz, como evitar?
- Estratégias de cache (cache-first, network-first, stale-while-revalidate), quando cada uma faz sentido?
- Como faria deploy de uma versão nova sem quebrar usuários offline com a versão antiga?

#### Resposta Questão 11:

Eu enxergo o Service Worker como um “proxy” da aplicação, com um ciclo de vida bem específico: primeiro ele instala (faz o download e, normalmente, já cacheia o shell do app), depois entra na fase de ativação (onde podemos limpar caches antigos e assumir controle das abas novas), e por fim fica rodando, interceptando requisições e decidindo se atende via rede, cache ou uma mistura dos dois. O clássico “app não atualiza nunca” normalmente vem do SW novo preso no estado “waiting” porque ainda tem aba usando o SW antigo. Pra evitar isso, eu versiono o arquivo do SW e, quando faz sentido, uso skipWaiting e uma mensagem pra UI avisando “tem versão nova, recarrega aí”. Em relação às estratégias de cache, uso cache-first pra assets realmente estáticos (logo, fontes), network-first pra dados que precisam estar sempre frescos (agenda do técnico, status de visita) e algo na linha de stale-while-revalidate pro shell, entregando o que está cacheado na hora e atualizando em background pra próxima visita. A outra metade da história é o backend ser amigável com versões antigas: não dá pra sair quebrando contrato de API agressivamente, porque sempre vai ter alguém com SW desatualizado em campo; então a API precisa aceitar por um tempo tanto o payload novo quanto o antigo, pra não jogar fora dados coletados offline.

### Questão 12. Sincronização offline

Você tem uma operação no PWA que precisa funcionar offline: "marcar visita como concluída, com observação e 5 fotos". Detalhe o fluxo completo:

- O que é gravado localmente, em qual estrutura.
- Como a UI se comporta (otimista? pendente? estados).
- Como a sincronização é disparada e retentada.
- O que acontece se o token de autenticação expirar enquanto o usuário estava offline.
- O que acontece se o servidor rejeitar a operação (ex.: visita já cancelada por outro caminho).

#### Resposta Questão 12:

No fluxo de “concluir visita com observação e 5 fotos”, eu penso sempre em comando offline bem definido. O PWA monta um objeto com visit_id, tipo de evento (concluída), observação, uma lista com as referências das fotos e uma idempotency_key, e grava isso numa fila local persistida (IndexedDB é o ideal; em V1 dá pra sobreviver com localStorage estruturado). As fotos ficam salvas localmente (blobs ou referências) até a hora do envio. A UI precisa ser honesta: assim que o técnico conclui, a visita passa pro estado “concluída, pendente de sync”, com um indicativo visual de que ainda falta enviar; ele não fica travado numa tela de loading, mas também não acha que já foi tudo pro servidor. Quando a conectividade volta (evento online ou checagens periódicas), o app pega essa fila em ordem e manda pro endpoint de sync, subindo os eventos e anexos. Se a rede falhar, o comando volta pra fila e o app tenta depois, com algum backoff pra não ficar martelando o backend. Se o token expirar enquanto ele estava offline, o primeiro sync toma um 401, o app pausa o processamento da fila, resolve autenticação de novo (login ou refresh token) e só então continua, sem apagar nada. Se o servidor responder 409 porque a visita foi cancelada no admin, aquele comando vira um item de “falha de sincronização”: não é reenviado, a UI explica o conflito pro técnico e o resto da fila continua fluindo normalmente.

***

## Bloco E — Qualidade e processo

### Questão 13. Testes

Como você equilibra testes unitários, de integração e end-to-end em um sistema full stack como o FieldOps? Onde investiria mais e por quê? O que é um bom teste vs. um teste teatral ("que aparece na cobertura mas não pega bug")?

#### Resposta Questão 13:

Eu costumo pensar em testes começando pelos unitários porque, enquanto estou projetando o sistema, já vou imaginando uma lista de coisas que podem dar errado: entradas esquisitas, estados de borda, combinações que ninguém deveria fazer mas alguém sempre faz. Conforme vou desenvolvendo, esses cenários vão aumentando, e eu uso isso como combustível pra escrever testes unitários que “prendam” a regra de negócio logo no começo. Também gosto de trocar essas ideias com o time: às vezes alguém enxerga um tipo de erro que eu não tinha considerado, e isso vira mais um caso de teste interessante.

Ao mesmo tempo, eu sei que o tempo de projeto nem sempre permite testar tudo em nível unitário com a profundidade que eu gostaria. Então, na prática, eu priorizo os caminhos que têm maior risco de quebrar o sistema ou de gerar impacto direto no usuário. Num produto como o FieldOps, por exemplo, dou prioridade pra testar bem a lógica de sync offline, a máquina de estados de visita, a parte de idempotência e os fluxos que mexem com dinheiro ou SLA. Esses testes podem ser unitários (funções de domínio bem isoladas) ou de integração, mas a régua é o risco: se quebrar, dói?

Pra mim, um bom equilíbrio é: testes unitários cobrindo as regras de negócio mais delicadas, testes de integração garantindo que API, banco e filas estão falando a mesma língua, e alguns poucos E2E só pros fluxos realmente críticos. O que eu tento evitar são testes “bonitos no relatório” e inúteis na prática, que só aumentam cobertura sem proteger nada importante. Prefiro menos testes, mas bem escolhidos e alinhados com os pontos onde a aplicação não pode falhar.

### Questão 14. CI/CD e deploy

Descreva um pipeline de CI/CD que você consideraria mínimo viável para uma equipe pequena (5 a 8 devs) trabalhando neste produto. Inclua: branching, validações automáticas, ambientes (dev/staging/prod), estratégia de deploy (blue-green, canário, rolling) e como você lidaria com um rollback de banco + código.

#### Resposta Questão 14:

Em time pequeno, eu prefiro um fluxo bem simples e disciplinado: tudo gira em torno de uma branch principal (main) e feature branches curtas. Cada PR obrigatoriamente passa por uma pipeline de CI que roda linters (Python, JS/TS), checagem de tipos e a suíte de testes principais; se não passou, não mergeia. Isso já evita boa parte dos “bugs óbvios” chegarem perto de produção.

Depois que o PR entra na main, o próximo passo pra mim é sempre ter pelo menos um ambiente separado de produção, normalmente um staging. O CD pega essa versão, faz o build das imagens Docker e sobe em staging automaticamente. A partir daí, eu gosto de trabalhar com uma etapa manual: alguém do time valida rapidamente os fluxos críticos (login, criação de entidade, alguma ação sensível) e, só então, dispara o deploy pra produção. Isso pode ser um botão no próprio pipeline ou um comando deploy-prod bem documentado, mas nunca algo 100% automático sem ninguém olhando.

Como ainda não vivi na prática cenários muito complexos de blue-green, canário ou rollback combinando várias versões de banco, eu prefiro assumir uma abordagem mais pé no chão: deploy incremental, com logs visíveis, healthcheck simples (um /health respondendo ok) e sempre com possibilidade de voltar pra versão anterior de forma explícita (por exemplo, reusando a imagem Docker anterior). O foco é ter um pipeline confiável e previsível, que o time todo entende, em vez de uma mega estratégia de deploy que ninguém domina.

### Questão 15. Mentoria e código de outros

Você fará code review. Descreva 3 padrões que você sempre cobra em review e 2 que você intencionalmente deixa passar (porque é estilo, não erro). Dê um exemplo concreto de cada.

#### Resposta Questão 15:

Quando atuo em Code Review, meu foco principal está no impacto real do código para a saúde do produto e na ajuda e compartilhamento de dicas para o desenvolvimento, evitando debates vazios. Com base na minha bagagem de desenvolvimento, estabeleci padrões claros do que é crítico e do que é apenas preferência estética.

3 padrões são:

Separação de responsabilidades na arquitetura. Eu cobro que a lógica de negócio fique isolada. Por exemplo, em uma API, se vejo um Controller acessando o banco de dados diretamente ou processando regras de negócio, eu peço para extrair isso para uma camada de Service.

Tipagem estrita e segurança do código. No TypeScript, o uso de tipos genéricos anula o propósito da ferramenta. Um exemplo concreto é o uso do 'any' ou asserções forçadas com 'as'. Se o código precisa de uma estrutura, exijo a criação de uma interface ou type bem definido.

Controle de efeitos colaterais e renderizações. No React/Next.js, o mau uso do ciclo de vida destrói a performance. Eu sempre cobro o array de dependências correto em hooks como o useEffect. Se vejo um efeito rodando a cada renderização por falta de atenção às dependências, o código volta.

2 padrões que eu deixo passar:

Sintaxe de declaração de funções. A escolha entre usar Arrow Functions ou Named Functions é puramente estética na maioria dos casos. Se o desenvolvedor cria um componente React como 'function Botao()' ou 'const Botao = () =>', eu deixo passar, pois o impacto prático é zero.

Estrutura de condicionais simples. Embora eu prefira o uso de Early Returns para evitar aninhamento, um bloco comum de 'if/else' em validações simples não quebra o sistema. Se a lógica está clara, não vejo motivo para mandar o desenvolvedor reescrever só para ficar do meu jeito.