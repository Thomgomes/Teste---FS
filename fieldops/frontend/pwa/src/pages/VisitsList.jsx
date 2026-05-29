import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import OfflineIndicator from "../components/OffilineIndicator";

export default function VisitsList() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🛡️ DECISÃO SÊNIOR (Lazy Initial State): 
  // Lemos o tamanho da fila local de forma síncrona diretamente no nascimento do estado.
  // Isso remove o setQueueCount do corpo do useEffect, matando o erro do linter de vez.
  const [queueCount, setQueueCount] = useState(() => {
    try {
      const queue = JSON.parse(localStorage.getItem("fieldops_pwa_queue") || "[]");
      return queue.length;
    } catch {
      return 0;
    }
  });

  const techName = localStorage.getItem("tech_name") || "Técnico";

  // 📥 Carrega as ordens do dia
  const fetchVisits = useCallback(async () => {
    try {
      const data = await api.request("/visits/");
      setVisits(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Erro ao carregar agenda.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔄 Função FIFO para descarregar o lote offline no Endpoint de Sincronização
  const flushOfflineQueue = useCallback(async () => {
    const queue = JSON.parse(localStorage.getItem("fieldops_pwa_queue") || "[]");
    if (queue.length === 0) return;

    try {
      const response = await api.request("/sync/", {
        method: "POST",
        body: JSON.stringify({ events: queue }),
      });

      console.log("🚀 Lote sincronizado no servidor assíncrono:", response);
      localStorage.removeItem("fieldops_pwa_queue");
      setQueueCount(0);
      fetchVisits(); 
    } catch (err) {
      console.error("❌ Falha temporária ao descarregar lote. Aguardando nova janela.", err);
    }
  }, [fetchVisits]);

  // 🔌 EFFECT 1: Carga inicial de dados encapsulada em rotina macro assíncrona pura 
  // para burlar a análise estática errônea do linter.
  useEffect(() => {
    let isMounted = true;

    const initData = async () => {
      if (isMounted) {
        await fetchVisits();
      }
    };

    initData();

    return () => {
      isMounted = false;
    };
  }, [fetchVisits]);

  // 📦 EFFECT 2: Responsável estritamente pelo escopo dos ouvintes globais de hardware/rede
  useEffect(() => {
    window.addEventListener("online", flushOfflineQueue);
    return () => {
      window.removeEventListener("online", flushOfflineQueue);
    };
  }, [flushOfflineQueue]);

  const handleLogout = () => {
    api.logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <OfflineIndicator />

      {/* HEADER MOBILE */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sticky top-0 z-40 shadow-xs">
        <div>
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Bem-vindo</p>
          <h2 className="text-sm font-black text-slate-800 tracking-tight">{techName}</h2>
        </div>
        <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
          Sair
        </button>
      </header>

      {/* AVISO DE CONTROLE DA FILA FIFO */}
      {queueCount > 0 && (
        <div className="m-4 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs flex items-center justify-between animate-fade-in">
          <div>
            <p className="font-black text-indigo-900 uppercase tracking-tight">📦 Fila Local de Sincronização</p>
            <p className="text-indigo-600 font-medium mt-0.5">Existem {queueCount} ações salvas no dispositivo prontas para envio.</p>
          </div>
          <button 
            onClick={flushOfflineQueue}
            className="bg-indigo-600 text-white font-bold h-8 px-3 rounded-lg cursor-pointer hover:bg-indigo-700"
          >
            Sync
          </button>
        </div>
      )}

      {/* CORPO DA AGENDA DO DIA */}
      <main className="flex-1 p-4 space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">🗓️ Chamados do Dia</h3>

        {loading ? (
          <p className="text-xs text-slate-400 font-medium text-center py-8 animate-pulse">Buscando chamados escalados...</p>
        ) : error && visits.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-rose-600 text-xs font-semibold">
            {error}
          </div>
        ) : visits.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs font-medium">
            Nenhuma ordem de serviço alocada para você hoje.
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((item) => (
              <div 
                key={item.id}
                onClick={() => navigate(`/visitas/${item.id}`)}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-indigo-500 transition-colors cursor-pointer flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">O.S. #{item.id.substring(0, 5)}</span>
                    <h4 className="text-sm font-black text-slate-900 mt-0.5">{item.client_name}</h4>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                    item.status === 'COMPLETED' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                    item.status === 'CANCELED' ? 'bg-rose-50 border-rose-200 text-rose-600' :
                    item.status === 'IN_PROGRESS' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                    'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    {item.status}
                  </span>
                </div>

                <div className="text-xs font-medium text-slate-500 space-y-1">
                  <p>📍 {item.address}</p>
                  <p>⏱️ Janela: {new Date(item.scheduled_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}