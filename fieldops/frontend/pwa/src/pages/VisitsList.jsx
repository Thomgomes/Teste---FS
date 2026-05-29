/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import OfflineIndicator from "../components/OfflineIndicator";

export default function VisitsList() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queueCount, setQueueCount] = useState(0);

  const techName = localStorage.getItem("tech_name") || "Técnico";

  const updateQueueCount = useCallback(() => {
    try {
      const queueKey = api.getQueueKey();
      const queue = JSON.parse(localStorage.getItem(queueKey) || "[]");
      setQueueCount(queue.length);
    } catch {
      setQueueCount(0);
    }
  }, []);

  const fetchVisits = useCallback(async () => {
    try {
      const data = await api.request("/visits/");
      let list = Array.isArray(data) ? data : [];

      const queueKey = api.getQueueKey();
      const queue = JSON.parse(localStorage.getItem(queueKey) || "[]");
      
      list = list.map(visit => {
        const pendingEvents = queue.filter(event => event.visit_id === visit.id);
        if (pendingEvents.length > 0) {
          const lastEvent = pendingEvents[pendingEvents.length - 1];
          return { ...visit, status: lastEvent.status_to_apply };
        }
        return visit;
      });

      setVisits(list);
      updateQueueCount();
    } catch (err) {
      setError(err.message || "Erro ao carregar agenda.");
    } finally {
      setLoading(false);
    }
  }, [updateQueueCount]);

  const flushOfflineQueue = useCallback(async () => {
    const queueKey = api.getQueueKey();
    const queue = JSON.parse(localStorage.getItem(queueKey) || "[]");
    if (queue.length === 0) return;

    try {
      await api.request("/sync/", {
        method: "POST",
        body: JSON.stringify({ events: queue }),
      });

      localStorage.removeItem(queueKey);
      alert("Fila local sincronizada com o servidor com sucesso!");
      setQueueCount(0);
      await fetchVisits(); 
    } catch (err) {
      alert(`Não foi possível sincronizar agora: ${err.message || "Verifique a ligação."}`);
    }
  }, [fetchVisits]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  useEffect(() => {
    window.addEventListener("online", flushOfflineQueue);
    return () => window.removeEventListener("online", flushOfflineQueue);
  }, [flushOfflineQueue]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <OfflineIndicator />

      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sticky top-0 z-40">
        <div>
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Bem-vindo</p>
          <h2 className="text-sm font-black text-slate-800 tracking-tight">{techName}</h2>
        </div>
        <button onClick={() => { api.logout(); navigate("/"); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
          Sair
        </button>
      </header>

      {queueCount > 0 && (
        <div className="m-4 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs flex items-center justify-between">
          <div>
            <p className="font-black text-indigo-900 uppercase tracking-tight">Ações Pendentes</p>
            <p className="text-indigo-600 font-medium mt-0.5">Existem {queueCount} atualizações salvas localmente.</p>
          </div>
          <button 
            onClick={flushOfflineQueue}
            className="bg-indigo-600 text-white font-bold h-8 px-3 rounded-lg cursor-pointer hover:bg-indigo-700"
          >
            Sincronizar
          </button>
        </div>
      )}

      <main className="flex-1 p-4 space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Chamados do Dia</h3>

        {loading ? (
          <p className="text-xs text-slate-400 font-medium text-center py-8 animate-pulse">Buscando chamados...</p>
        ) : visits.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs font-medium">
            Nenhuma ordem de serviço alocada para hoje.
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((item) => {
              let displayStatus = (item.status || "").toUpperCase();
              let friendlyText = item.status;

              if (displayStatus === "AGENDADA" || displayStatus === "SCHEDULED") { displayStatus = "SCHEDULED"; friendlyText = "AGENDADA"; }
              if (displayStatus === "EM_DESLOCAMENTO" || displayStatus === "IN_DISPLACEMENT") { displayStatus = "IN_DISPLACEMENT"; friendlyText = "EM DESLOCAMENTO"; }
              if (displayStatus === "EM_ATENDIMENTO" || displayStatus === "EM_ANDAMENTO" || displayStatus === "IN_PROGRESS") { displayStatus = "IN_PROGRESS"; friendlyText = "EM ATENDIMENTO"; }
              if (displayStatus === "CONCLUIDA" || displayStatus === "COMPLETED") { displayStatus = "COMPLETED"; friendlyText = "CONCLUÍDA"; }
              if (displayStatus === "CANCELADA" || displayStatus === "CANCELED") { displayStatus = "CANCELED"; friendlyText = "CANCELADA"; }

              return (
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
                      displayStatus === 'COMPLETED' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                      displayStatus === 'CANCELED' ? 'bg-rose-50 border-rose-200 text-rose-600' :
                      displayStatus === 'IN_PROGRESS' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                      displayStatus === 'IN_DISPLACEMENT' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' :
                      'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      {friendlyText}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500">{item.address}</p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}