/* eslint-disable no-unused-vars */
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
  },

  async uploadPhoto(visitId, fileOrBlob, filename = "foto.jpg") {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", fileOrBlob, filename);

    const response = await fetch(`${API_URL}/visits/${visitId}/attachments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Falha ao enviar foto.");
    }

    return await response.json();
  },

  async syncQueue() {
    const queueKey = this.getQueueKey();
    const queue = JSON.parse(localStorage.getItem(queueKey) || "[]");

    if (queue.length === 0) return { synced: 0, errors: 0 };

    const remaining = [];
    let synced = 0;
    let errors = 0;

    for (const item of queue) {
      try {
        if (item._type === "PHOTO_UPLOAD") {
          const fetchRes = await fetch(item.base64);
          const blob = await fetchRes.blob();
          await this.uploadPhoto(item.visit_id, blob, item.filename || "foto.jpg");
        } else {
          await this.request("/sync/", {
            method: "POST",
            body: JSON.stringify({ events: [item] }),
          });
        }
        synced++;
      } catch (err) {
        remaining.push(item);
        errors++;
      }
    }

    localStorage.setItem(queueKey, JSON.stringify(remaining));
    return { synced, errors };
  },
};