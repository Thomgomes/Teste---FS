import { useState } from "react";
import { api } from "../api/api";

export default function VisitModal({ isOpen, onClose, technicians, onSaveSuccess }) {
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientName || !address || !technicianId || !scheduledAt) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.request("/visits/", {
        method: "POST",
        body: JSON.stringify({
          client_name: clientName,
          address: address,
          technician_id: technicianId,
          scheduled_at: new Date(scheduledAt).toISOString(),
        }),
      });

      // Limpa os estados do formulário
      setClientName("");
      setAddress("");
      setTechnicianId("");
      setScheduledAt("");
      
      onSaveSuccess(); // Recarrega a grade do Dashboard automaticamente
      onClose(); // Fecha o modal
    } catch (err) {
      setError(err.message || "Falha ao registrar nova ordem de serviço.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
        
        {/* CABEÇALHO */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
            ➕ Agendar Nova Ordem de Campo
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-sm">
            ✕
          </button>
        </div>

        {/* ERRO */}
        {error && (
          <div className="mx-6 mt-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nome do Cliente / Empresa</label>
            <input
              type="text"
              required
              placeholder="Ex: Hospital Alvorada"
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-medium"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Endereço Completo</label>
            <input
              type="text"
              required
              placeholder="Ex: Av. Governador, 120 - Centro"
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-medium"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Designar Técnico Especialista</label>
            <select
              required
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold cursor-pointer"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              disabled={loading}
            >
              <option value="">Selecione um profissional...</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  👷‍♂️ {tech.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Data e Hora Prevista</label>
            <input
              type="datetime-local"
              required
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-medium"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-10 px-4 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-indigo-100 cursor-pointer disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? "Salvando..." : "Confirmar Agendamento"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}