/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/api";
import OfflineIndicator from "../components/OffilineIndicator";

export default function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Busca a visita no cache ou via API
    api.request("/visits/")
      .then((list) => {
        const match = list.find((v) => v.id === id);
        if (match) setVisit(match);
        else setError("Visita não localizada.");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // 🔥 INTERCEPTADOR OFFLINE INDEPENDENTE: Cria a ação e guarda na fila FIFO local se a rede cair
  const handleStateTransition = async (eventType, statusToApply, description) => {
    const actionPayload = {
      visit_id: id,
      event_type: eventType,
      description: description,
      idempotency_key: `idemp-tech-${crypto.randomUUID()}`,
      created_at: new Date().toISOString(),
      status_to_apply: statusToApply
    };

    // Atualização Otimista da Interface para o técnico não achar que o app travou
    setVisit((prev) => ({ ...prev, status: statusToApply }));

    try {
      if (!navigator.onLine) {
        throw new TypeError("Failed to fetch"); // Força a queda controlada no bloco catch
      }

      // Se houver rede estável, tenta descarregar a ação imediatamente
      await api.request("/sync/", {
        method: "POST",
        body: JSON.stringify({ events: [actionPayload] })
      });
      alert("Ação sincronizada com a central com sucesso!");
    } catch (err) {
      // 💾 SALVAMENTO RESILIENTE EM FILA LOCAL (EDITAL COMPLIANCE)
      const currentQueue = JSON.parse(localStorage.getItem("fieldops_pwa_queue") || "[]");
      currentQueue.push(actionPayload);
      localStorage.setItem("fieldops_pwa_queue", JSON.stringify(currentQueue));
      
      alert("Dispositivo sem sinal. Progresso gravado localmente e agendado para sincronização automática.");
    }
  };

  if (loading) return <p className="p-6 text-xs text-slate-400 font-bold text-center">Carregando detalhes do chamado...</p>;
  if (error || !visit) return <p className="p-6 text-xs text-rose-600 font-bold text-center">{error || "Visita não localizada."}</p>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <OfflineIndicator />

      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 gap-3">
        <button onClick={() => navigate("/visitas")} className="text-slate-400 text-sm font-bold">⬅️ Voltar</button>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-xs font-black text-slate-500 uppercase">Acompanhamento O.S.</span>
      </header>

      <main className="p-4 flex-1 flex flex-col justify-between">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase">{visit.status}</span>
            <h2 className="text-lg font-black text-slate-900 mt-2">{visit.client_name}</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">📍 {visit.address}</p>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
            📅 Agendado para: {new Date(visit.scheduled_at).toLocaleString("pt-BR")}
          </div>
        </div>

        {/* 🎛️ PAINEL DINÂMICO DE AÇÕES DO TÉCNICO NO CELULAR */}
        <div className="pt-6 space-y-3">
          {visit.status === "SCHEDULED" && (
            <button 
              onClick={() => handleStateTransition("INICIAR_DESLOCAMENTO", "IN_DISPLACEMENT", "Técnico iniciou o trajeto físico.")}
              className="w-full h-12 bg-indigo-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
            >
              🚀 Iniciar Deslocamento
            </button>
          )}

          {visit.status === "IN_DISPLACEMENT" && (
            <button 
              onClick={() => handleStateTransition("INICIAR_ATENDIMENTO", "IN_PROGRESS", "Chegou no local e iniciou os reparos.")}
              className="w-full h-12 bg-amber-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
            >
              ⚡ Iniciar Atendimento
            </button>
          )}

          {visit.status === "IN_PROGRESS" && (
            <button 
              onClick={() => handleStateTransition("CONCLUIR_VISITA", "COMPLETED", "Serviço finalizado com sucesso.")}
              className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
            >
              ✅ Concluir Ordem de Serviço
            </button>
          )}

          {/* ESTADOS TERMINAIS */}
          {(visit.status === "COMPLETED" || visit.status === "CANCELED") && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500 font-bold uppercase tracking-tight">
              🔒 Chamado Encerrado ({visit.status})
            </div>
          )}
        </div>
      </main>
    </div>
  );
}