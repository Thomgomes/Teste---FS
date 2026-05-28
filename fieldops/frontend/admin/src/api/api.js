const API_URL = "http://localhost:8000/api/v1";

export const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem("fieldops_token");

    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const cleanEndpoint = endpoint.startsWith("/")
        ? endpoint
        : `/${endpoint}`;

      const response = await fetch(
        `http://localhost:8000/api/v1${cleanEndpoint}`,
        {
          ...options,
          headers,
        },
      );

      if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.location.href = "/";
        throw new Error(
          "Sua sessão expirou ou você não tem permissão de acesso.",
        );
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Erro na requisição");
      }

      return await response.json();
    } catch (err) {
      if (err.message === "Failed to fetch" || err.name === "TypeError") {
        throw (
          new Error(
            "Falha de conexão: Verifique se o servidor está online ou se há bloqueio de segurança (CORS).",
          ),
          { cause: err }
        );
      }
      throw err;
    }
  },

  async login(email, password) {
    // O OAuth2PasswordRequestForm do FastAPI espera form-data ou URL encoded
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "E-mail ou senha incorretos.");
    }

    return response.json();
  },
};
