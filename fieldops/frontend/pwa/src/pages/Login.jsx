import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const data = await api.request("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      console.log("🚀 Payload de Login validado no DevTools:", data);

      // 🛡️ CASAMENTO PERFEITO DE CONTRATO COM O TEU BACKEND:
      // Mapeamos diretamente da raiz do objeto (data.role e data.name)
      // e convertemos para minúsculo para bater com "tecnico"
      const userRole = (data.role || "").toLowerCase();
      const userName = data.name || "Técnico";

      if (userRole !== "tecnico") {
        throw new Error("Acesso negado. Este aplicativo é exclusivo para técnicos de campo.");
      }

      // Salva os estados de autenticação corporativos no LocalStorage do PWA
      api.setToken(data.access_token);
      localStorage.setItem("tech_name", userName);
      
      navigate("/visitas");
    } catch (err) {
      setError(err.message || "Credenciais inválidas para o perfil técnico.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center p-4">
      <div className="max-w-md w-full mx-auto bg-white rounded-3xl p-6 shadow-xl space-y-6">
        <div className="text-center">
          <span className="text-xl">👷‍♂️</span>
          <h1 className="text-xl font-black text-slate-900 mt-2 tracking-tight">FieldOps Tech</h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Portal de Operações de Campo</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">E-mail Técnico</label>
            <input
              type="email"
              required
              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-medium"
              placeholder="exemplo@ops.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Senha de Acesso</label>
            <input
              type="password"
              required
              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-medium"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-indigo-100 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            {loading ? "Autenticando..." : "Entrar no Painel"}
          </button>
        </form>
      </div>
    </div>
  );
}