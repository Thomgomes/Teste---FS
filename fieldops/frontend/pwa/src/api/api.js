const API_URL = "http://localhost:8000/api/v1";

export const api = {
  getToken() {
    return localStorage.getItem("tech_token");
  },
  
  setToken(token) {
    localStorage.setItem("tech_token", token);
  },

  getQueueKey() {
    const email = localStorage.getItem("tech_email") || "guest";
    return `fieldops_queue_${email}`;
  },

  logout() {
    localStorage.removeItem("tech_token");
    localStorage.removeItem("tech_name");
    localStorage.removeItem("tech_email");
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
        let errorMessage = "Falha na comunicação corporativa.";
        if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail) && errorData.detail[0]?.msg) {
            errorMessage = errorData.detail[0].msg;
          }
        }
        const apiError = new Error(errorMessage);
        apiError.isServerError = true; 
        throw apiError;
      }

      return await response.json();
    } catch (error) {
      if (error.isServerError) {
        throw error;
      }
      
      if (endpoint === "/visits/" && (!options.method || options.method === "GET")) {
        const cachedData = localStorage.getItem("fieldops_offline_visitas");
        if (cachedData) return JSON.parse(cachedData);
      }
      throw error;
    }
  }
};