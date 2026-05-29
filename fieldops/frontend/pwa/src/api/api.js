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
    localStorage.removeItem("tech_name");
    localStorage.removeItem("fieldops_offline_visitas");
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    
    // 🛡️ CORREÇÃO DE OURO: Permite que a tela defina x-www-form-urlencoded
    // Se a tela não passar nada, adota application/json por padrão
    const headers = {
      "Content-Type": options.headers?.["Content-Type"] || "application/json",
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
        
        let errorMessage = "Falha na comunicação corporativa.";
        if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail) && errorData.detail[0]?.msg) {
            errorMessage = errorData.detail[0].msg;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (endpoint === "/visits/" && (!options.method || options.method === "GET")) {
        localStorage.setItem("fieldops_offline_visitas", JSON.stringify(data));
      }

      return data;
    } catch (error) {
      if (error.name === "TypeError" || !navigator.onLine) {
        if (endpoint === "/visits/" && (!options.method || options.method === "GET")) {
          const cachedData = localStorage.getItem("fieldops_offline_visitas");
          if (cachedData) {
            return JSON.parse(cachedData);
          }
        }
      }
      throw error;
    }
  }
};