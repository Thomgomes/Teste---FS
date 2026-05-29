const CACHE_NAME = "fieldops-tech-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/src/main.jsx",
  "/src/App.jsx",
  "/src/index.css",
  "/manifest.json",
  "/favicon.svg"
];

// 1. Instalação: Cacheia os assets estruturais iniciais
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Ativação: Limpa caches antigos se houver atualização de versão
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Interceptação (Fetch): Estratégia Network-First para assets estáticos
self.addEventListener("fetch", (event) => {
  // Ignora requisições de API (o nosso código JS tratará o offline da API via IndexedDB/LocalStorage)
  if (event.request.url.includes("/api/v1/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a rede respondeu, clona e guarda no cache para o futuro
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se a rede falhar (Offline), serve o ficheiro direto do cache
        return caches.match(event.request);
      })
  );
});