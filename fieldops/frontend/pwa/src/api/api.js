const API_URL = "http://localhost:8000/api/v1";

export const api = {
  getToken() {
    return localStorage.getItem("tech_token");
  },
  
  setToken(token) {
    localStorage.setItem("tech_token", token);
  },

  logout() {
    localStorage.removeItem("tech_token");
    localStorage.removeItem("fieldops_offline_visitas");
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Falha na comunicação corporativa.");
      }

      const data = await response.json();
      
      // 💾 Se for a listagem de visitas de campo bem-sucedida, atualiza o cache offline
      if (endpoint === "/visits/" && (!options.method || options.method === "GET")) {
        localStorage.setItem("fieldops_offline_visitas", JSON.stringify(data));
      }

      return data;
    } catch (error) {
      // 📶 INTERCEPTOR DE REDE (FALLBACK OFFLINE CRÍTICO)
      if (error.message.includes("Failed to fetch") || !navigator.onLine) {
        if (endpoint === "/visits/" && (!options.method || options.method === "GET")) {
          const cachedData = localStorage.getItem("fieldops_offline_visitas");
          if (cachedData) {
            console.warn("⚠️ Dispositivo sem sinal de rede. Servindo dados do cache local.");
            return JSON.parse(cachedData);
          }
        }
      }
      throw error;
    }
  }
};