import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

export default function ClientPage() {
  const { token } = useParams();
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`http://localhost:8000/api/v1/public/v/${token}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Link de acompanhamento inválido, expirado ou inexistente.");
        }
        return res.json();
      })
      .then((data) => setVisit(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 animate-pulse">
          Buscando informações do seu atendimento...
        </span>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center max-w-sm w-full shadow-2xl">
          <p className="text-rose-400 font-semibold text-sm mb-2">⚠️ Link Inválido</p>
          <p className="text-xs text-slate-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // Usa os campos do PublicVisitTrackResponse (schema público em português)
  const statusRaw = (visit.status_atual || "").toUpperCase();

  const statusMapping = {
    SCHEDULED:        { text: "Agendado",          color: "bg-blue-500/10 text-blue-400 border-blue-500/20",    icon: "⏳" },
    AGENDADA:         { text: "Agendado",          color: "bg-blue-500/10 text-blue-400 border-blue-500/20",    icon: "⏳" },
    IN_DISPLACEMENT:  { text: "Técnico a Caminho", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", icon: "🚀" },
    EM_DESLOCAMENTO:  { text: "Técnico a Caminho", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", icon: "🚀" },
    IN_PROGRESS:      { text: "Em Manutenção",     color: "bg-amber-500/10 text-amber-400 border-amber-500/20",  icon: "⚡" },
    EM_ATENDIMENTO:   { text: "Em Manutenção",     color: "bg-amber-500/10 text-amber-400 border-amber-500/20",  icon: "⚡" },
    EM_ANDAMENTO:     { text: "Em Manutenção",     color: "bg-amber-500/10 text-amber-400 border-amber-500/20",  icon: "⚡" },
    COMPLETED:        { text: "Concluído",          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: "✅" },
    CONCLUIDA:        { text: "Concluído",          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: "✅" },
    CANCELED:         { text: "Cancelado",          color: "bg-rose-500/10 text-rose-400 border-rose-500/20",    icon: "🚫" },
    CANCELADA:        { text: "Cancelado",          color: "bg-rose-500/10 text-rose-400 border-rose-500/20",    icon: "🚫" },
  };

  const currentStatus = statusMapping[statusRaw] || {
    text: visit.status_atual,
    color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    icon: "📋",
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center p-4">
      <div className="max-w-md w-full mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">

        {/* CABEÇALHO */}
        <div className="border-b border-slate-800 pb-4 text-center sm:text-left">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Acompanhamento Público</p>
          <h1 className="text-lg font-black text-white mt-0.5 tracking-tight">Status do Chamado</h1>
        </div>

        {/* STATUS */}
        <div className={`flex items-center justify-between border rounded-2xl p-4 ${currentStatus.color}`}>
          <div>
            <p className="text-[9px] font-black uppercase opacity-60 tracking-wider">Situação Atual</p>
            <p className="text-sm font-black mt-0.5 uppercase tracking-wide">{currentStatus.text}</p>
          </div>
          <span className="text-2xl">{currentStatus.icon}</span>
        </div>

        {/* DADOS */}
        <div className="space-y-4 text-xs font-semibold text-slate-300">
          <div className="bg-slate-950/40 p-3 border border-slate-800/60 rounded-xl">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Profissional Alocado</p>
            {/* ✅ campo correto: tecnico_designado.nome */}
            <p className="text-white font-bold">{visit.tecnico_designado?.nome || "Buscando profissional..."}</p>
          </div>

          <div className="bg-slate-950/40 p-3 border border-slate-800/60 rounded-xl">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Janela de Atendimento Prevista</p>
            {/* ✅ campo correto: janela_agendada */}
            <p className="text-white font-bold">{new Date(visit.janela_agendada).toLocaleString("pt-BR")}</p>
          </div>

          <div className="bg-slate-950/40 p-3 border border-slate-800/60 rounded-xl">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Cliente</p>
            {/* ✅ campo correto: cliente */}
            <p className="text-white font-bold">{visit.cliente}</p>
          </div>
        </div>

        {/* TIMELINE */}
        <div className="space-y-3 pt-2">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
            Histórico de Evolução
          </h3>

          {(!visit.linha_do_tempo || visit.linha_do_tempo.length === 0) ? (
            <p className="text-[11px] font-medium text-slate-500 text-center py-2">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="relative border-l border-slate-800 ml-2 pl-4 space-y-4">
              {/* ✅ campo correto: linha_do_tempo, com momento e detalhes */}
              {visit.linha_do_tempo.map((evt, idx) => (
                <div key={idx} className="relative text-xs">
                  <div className="absolute -left-5.25 top-1 bg-indigo-500 h-2 w-2 rounded-full border border-slate-950" />
                  <p className="font-bold text-slate-200">{evt.detalhes}</p>
                  <span className="text-[9px] text-slate-500 font-medium block mt-0.5">
                    {new Date(evt.momento).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">
            🔒 Ambiente em conformidade com as diretrizes da LGPD
          </p>
        </div>
      </div>
    </div>
  );
}