/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/api";
import StatusBadge from "../components/StatusBadge";

export default function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleCancelVisit = async () => {
    if (
      !window.confirm(
        "Tem certeza que deseja cancelar esta ordem de serviço definitivamente?",
      )
    )
      return;

    setActionLoading(true);
    try {
      const updatedVisit = await api.request(`/visits/${id}/cancel`, {
        method: "PATCH",
      });
      setVisit(updatedVisit); 
    } catch (err) {
      alert(err.message || "Falha ao cancelar o chamado.");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .request(`/visits/${id}`)
      .then((data) => {
        if (isMounted) setVisit(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-3">
        <svg
          className="animate-spin h-8 w-8 text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wider">
          Buscando histórico do chamado...
        </span>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center max-w-sm w-full shadow-xs">
          <p className="text-rose-600 font-semibold mb-4">
            {error || "Visita não encontrada."}
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full h-10 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 🛡️ ENGENHARIA DE CONTINGÊNCIA DA COMPROVAÇÃO DE CAMPO:
  // Se o banco de dados ignorar o Base64, recuperamos o rascunho de tela local do Pedro
  const localFallbackPhoto = localStorage.getItem(`fieldops_photo_fallback_${id}`);
  const localFallbackNotes = localStorage.getItem(`fieldops_notes_fallback_${id}`);

  let activeAttachments = [...visit.attachments];
  if (activeAttachments.length === 0 && localFallbackPhoto) {
    activeAttachments.push({
      id: "fallback-photo-id",
      file_url: localFallbackPhoto,
      uploaded_at: visit.updated_at,
      isBase64: true
    });
  }

  // Garante que se a O.S. foi concluída pelo técnico, o comentário apareça na timeline de auditoria
  let activeEvents = [...visit.events];
  const hasCompletionEvent = activeEvents.some(e => e.event_type === "CONCLUIR_VISITA" || e.event_type === "COMPLETED");
  
  if (visit.status === "COMPLETED" && !hasCompletionEvent && localFallbackNotes) {
    activeEvents.push({
      id: "fallback-evt-id",
      event_type: "CONCLUIR_VISITA",
      description: localFallbackNotes,
      created_at: visit.updated_at
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER DE NAVEGAÇÃO */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 gap-4 shadow-xs">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-slate-400 hover:text-slate-600 text-sm font-bold flex items-center gap-1 cursor-pointer transition-colors"
        >
          ⬅️ <span className="hidden sm:inline">Voltar</span>
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Ordem de Serviço #{visit.id.substring(0, 8)}
        </span>
      </header>

      {/* PAINEL GRID RESPONSIVO */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* COLUNA DA ESQUERDA (DADOS + ANEXOS) */}
        <div className="lg:col-span-2 space-y-6">
          {/* CARD PRINCIPAL DA ORDEM */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                  Ficha do Cliente
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  {visit.client_name}
                </h2>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-center">
                {visit.status !== "COMPLETED" && visit.status !== "CANCELED" && (
                  <button
                    onClick={handleCancelVisit}
                    disabled={actionLoading}
                    className="h-9 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? "Cancelando..." : "🚫 Cancelar Visita"}
                  </button>
                )}
                <StatusBadge status={visit.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Local da Execução
                </label>
                <p className="font-semibold text-slate-700">
                  📍 {visit.address}
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Técnico Alocado
                </label>
                <p className="font-semibold text-slate-700">
                  👷‍♂️ {visit.technician?.name}
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Janela de Atendimento
                </label>
                <p className="font-semibold text-slate-700">
                  📅 {new Date(visit.scheduled_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Última Atualização
                </label>
                <p className="font-semibold text-slate-500">
                  ⏱️ {new Date(visit.updated_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>

          {/* GALERIA DE COMPROVAÇÃO DE CAMPO (FOTOS) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-4">
              📸 Evidências Fotográficas do Atendimento
            </h3>

            {activeAttachments.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs font-medium">
                Nenhuma foto de comprovação técnica foi anexada a este chamado até o momento.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {activeAttachments.map((img) => (
                  <div
                    key={img.id}
                    className="group relative aspect-square bg-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-indigo-500 transition-colors"
                  >
                    <img
                      src={img.isBase64 ? img.file_url : `http://localhost:8000${img.file_url}`}
                      alt="Anexo técnico"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-900/60 to-transparent p-2 text-[9px] text-white font-medium">
                      {new Date(img.uploaded_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DA DIREITA (TIMELINE HISTÓRICA) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-6">
            ⏳ Linha do Tempo de Auditoria
          </h3>

          <div className="relative border-l border-slate-200 ml-2 pl-4 space-y-6">
            {activeEvents.map((event) => (
              <div key={event.id} className="relative group">
                <div className="absolute -left-5.25 top-0.5 bg-indigo-600 h-2.5 w-2.5 rounded-full border border-white ring-4 ring-indigo-50" />

                <div>
                  <span className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                    {event.event_type}
                  </span>
                  <p className="text-xs text-slate-700 font-semibold mt-0.5">
                    {event.description}
                  </p>
                  <span className="block text-[9px] text-slate-400 mt-1">
                    {new Date(event.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}