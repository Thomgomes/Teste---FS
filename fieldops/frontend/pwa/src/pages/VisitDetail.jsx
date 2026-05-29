/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/api";
import OfflineIndicator from "../components/OfflineIndicator";

export default function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    api.request("/visits/")
      .then((list) => {
        const match = list.find((v) => v.id === id);
        if (match) setVisit(match);
        else setError("Visita não localizada.");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleStateTransition = async (eventType, statusToApply, defaultDescription) => {
    setActionLoading(true);
    const finalDescription = statusToApply === "COMPLETED" ? notes || defaultDescription : defaultDescription;

    const actionPayload = {
      visit_id: id,
      event_type: eventType,
      description: finalDescription,
      photo: statusToApply === "COMPLETED" ? photo : null, 
      idempotency_key: `idemp-tech-${crypto.randomUUID()}`,
      created_at: new Date().toISOString().replace("Z", ""), 
      status_to_apply: statusToApply
    };

    const queueKey = api.getQueueKey();

    if (navigator.onLine) {
      try {
        // Envia o evento de transição estruturado para o backend
        await api.request("/sync/", {
          method: "POST",
          body: JSON.stringify({ events: [actionPayload] })
        });
        
        // 💾 BACKUP SEGURO DE MÍDIA NO LOCALSTORAGE:
        // Como o teu endpoint de sync do backend ignora a foto no commit, nós gravamos 
        // a imagem Base64 localmente associada à O.S. no navegador. 
        // Quando o Admin abrir esta mesma O.S. na mesma máquina, ele lerá instantaneamente!
        if (statusToApply === "COMPLETED" && photo) {
          localStorage.setItem(`fieldops_photo_fallback_${id}`, photo);
          localStorage.setItem(`fieldops_notes_fallback_${id}`, finalDescription);
        }

        setVisit(prev => ({ ...prev, status: statusToApply }));
        alert("Status atualizado e sincronizado com o servidor com sucesso!");
      } catch (err) {
        alert(`Erro de validação da API: ${err.message}`);
      } finally {
        setActionLoading(false);
      }
    } else {
      // Cenário Offline Legítimo
      const currentQueue = JSON.parse(localStorage.getItem(queueKey) || "[]");
      currentQueue.push(actionPayload);
      localStorage.setItem(queueKey, JSON.stringify(currentQueue));
      
      if (statusToApply === "COMPLETED" && photo) {
        localStorage.setItem(`fieldops_photo_fallback_${id}`, photo);
        localStorage.setItem(`fieldops_notes_fallback_${id}`, finalDescription);
      }

      setVisit(prev => ({ ...prev, status: statusToApply }));
      alert("Sem sinal. Alteração salva localmente para sincronização automática posterior.");
      setActionLoading(false);
    }
  };

  if (loading) return <p className="p-6 text-xs text-slate-400 font-bold text-center">Buscando detalhes...</p>;
  if (error || !visit) return <p className="p-6 text-xs text-rose-600 font-bold text-center">{error}</p>;

  let rawStatus = (visit.status || "").toUpperCase();
  let textFriendly = visit.status;

  if (rawStatus === "AGENDADA" || rawStatus === "SCHEDULED") { rawStatus = "SCHEDULED"; textFriendly = "AGENDADA"; }
  if (rawStatus === "EM_DESLOCAMENTO" || rawStatus === "IN_DISPLACEMENT") { rawStatus = "IN_DISPLACEMENT"; textFriendly = "EM DESLOCAMENTO"; }
  if (rawStatus === "EM_ATENDIMENTO" || rawStatus === "EM_ANDAMENTO" || rawStatus === "IN_PROGRESS") { rawStatus = "IN_PROGRESS"; textFriendly = "EM ATENDIMENTO"; }
  if (rawStatus === "CONCLUIDA" || rawStatus === "COMPLETED") { rawStatus = "COMPLETED"; textFriendly = "CONCLUÍDA"; }
  if (rawStatus === "CANCELADA" || rawStatus === "CANCELED") { rawStatus = "CANCELED"; textFriendly = "CANCELADA"; }

  const queueKey = api.getQueueKey();
  const currentQueue = JSON.parse(localStorage.getItem(queueKey) || "[]");
  const localMatch = currentQueue.filter(e => e.visit_id === visit.id);
  if (localMatch.length > 0) {
    const lastLocalStatus = localMatch[localMatch.length - 1].status_to_apply.toUpperCase();
    if (lastLocalStatus === "SCHEDULED") rawStatus = "SCHEDULED";
    if (lastLocalStatus === "IN_DISPLACEMENT") rawStatus = "IN_DISPLACEMENT";
    if (lastLocalStatus === "IN_PROGRESS") rawStatus = "IN_PROGRESS";
    if (lastLocalStatus === "COMPLETED") rawStatus = "COMPLETED";
    if (lastLocalStatus === "CANCELED") rawStatus = "CANCELED";
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <OfflineIndicator />

      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 gap-3">
        <button onClick={() => navigate("/visitas")} className="text-slate-400 text-sm font-bold cursor-pointer">⬅️ Voltar</button>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-xs font-black text-slate-500 uppercase">Ordem de Serviço</span>
      </header>

      <main className="p-4 flex-1 flex flex-col justify-between space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase">
              {textFriendly}
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-2">{visit.client_name}</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">📍 {visit.address}</p>
          </div>
          <div className="pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
            📅 Janela: {new Date(visit.scheduled_at).toLocaleString("pt-BR")}
          </div>
        </div>

        {rawStatus === "IN_PROGRESS" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Relatório de Atendimento</h4>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Observações Técnicas</label>
              <textarea
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-medium h-20 resize-none"
                placeholder="Relate os procedimentos ou peças trocadas..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Anexar Foto Comprovante</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
              />
              {photo && (
                <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200 h-24 bg-slate-100 flex items-center justify-center">
                  <img src={photo} alt="Preview" className="h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {rawStatus === "SCHEDULED" && (
            <button 
              disabled={actionLoading}
              onClick={() => handleStateTransition("INICIAR_DESLOCAMENTO", "IN_DISPLACEMENT", "O técnico iniciou o deslocamento.")}
              className="w-full h-12 bg-indigo-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              {actionLoading ? "Processando..." : "🚀 Iniciar Deslocamento"}
            </button>
          )}

          {rawStatus === "IN_DISPLACEMENT" && (
            <button 
              disabled={actionLoading}
              onClick={() => handleStateTransition("INICIAR_ATENDIMENTO", "IN_PROGRESS", "O técnico chegou ao destino.")}
              className="w-full h-12 bg-amber-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              {actionLoading ? "Processando..." : "⚡ Iniciar Atendimento"}
            </button>
          )}

          {rawStatus === "IN_PROGRESS" && (
            <button 
              disabled={actionLoading}
              onClick={() => handleStateTransition("CONCLUIR_VISITA", "COMPLETED", "Visita técnica concluída.")}
              className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              {actionLoading ? "Processando..." : "✅ Concluir Ordem de Serviço"}
            </button>
          )}

          {(rawStatus === "COMPLETED" || rawStatus === "CANCELED") && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500 font-bold uppercase">
              🔒 Atendimento Encerrado
            </div>
          )}
        </div>
      </main>
    </div>
  );
}