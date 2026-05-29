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
  
  // 📝 Estados para capturar os dados exigidos pela prova
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Busca a listagem local/remota para achar a visita correspondente
    api.request("/visits/")
      .then((list) => {
        const match = list.find((v) => v.id === id);
        if (match) setVisit(match);
        else setError("Visita não localizada.");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Converte a foto capturada pelo celular do técnico para Base64 (para persistência local)
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result); // String em formato Base64
      };
      reader.readAsDataURL(file);
    }
  };

  // 🔥 ALTERA A INSTÂNCIA DO SERVIÇO (Mecânica Otimista e Fila FIFO Local)
  const handleStateTransition = async (eventType, statusToApply, defaultDescription) => {
    setActionLoading(true);
    const finalDescription = statusToApply === "COMPLETED" ? notes || defaultDescription : defaultDescription;

    // Constrói o payload exatamente como o teu schema 'VisitEventSchema' do backend espera
    const actionPayload = {
      visit_id: id,
      event_type: eventType,
      description: finalDescription,
      photo: statusToApply === "COMPLETED" ? photo : null,
      idempotency_key: `idemp-tech-${crypto.randomUUID()}`,
      created_at: new Date().toISOString(),
      status_to_apply: statusToApply
    };

    // 1. Atualização Otimista: Muda o estado visual no PWA imediatamente
    setVisit((prev) => ({ ...prev, status: statusToApply }));

    try {
      // Força queda controlada se o navegador estiver sem internet
      if (!navigator.onLine) {
        throw new TypeError("Failed to fetch");
      }

      // Envia o lote contendo o evento de transição direto para o teu endpoint /sync/
      await api.request("/sync/", {
        method: "POST",
        body: JSON.stringify({ events: [actionPayload] })
      });
      
      alert("Status atualizado e sincronizado com o servidor!");
      navigate("/visitas");
    } catch (err) {
      // 💾 SALVAMENTO NA FILA FIFO LOCAL (LocalStorage)
      const currentQueue = JSON.parse(localStorage.getItem("fieldops_pwa_queue") || "[]");
      currentQueue.push(actionPayload);
      localStorage.setItem("fieldops_pwa_queue", JSON.stringify(currentQueue));
      
      alert("Modo Offline: Alteração guardada localmente na fila de sincronização.");
      navigate("/visitas");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="p-6 text-xs text-slate-400 font-bold text-center">Buscando detalhes da O.S...</p>;
  if (error || !visit) return <p className="p-6 text-xs text-rose-600 font-bold text-center">{error}</p>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <OfflineIndicator />

      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 gap-3">
        <button onClick={() => navigate("/visitas")} className="text-slate-400 text-sm font-bold cursor-pointer">⬅️ Voltar</button>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-xs font-black text-slate-500 uppercase">Ordem de Serviço</span>
      </header>

      <main className="p-4 flex-1 flex flex-col justify-between space-y-6">
        {/* CARD PRINCIPAL DA VISITA */}
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

        {/* 📋 FORMULÁRIO DE CONCLUSÃO (Aparece apenas se a O.S. for iniciada) */}
        {visit.status === "IN_PROGRESS" && (
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

        {/* 🎛️ BOTÕES DINÂMICOS DE TRANSIÇÃO DE STATUS */}
        <div className="space-y-3">
          {visit.status === "SCHEDULED" && (
            <button 
              disabled={actionLoading}
              onClick={() => handleStateTransition("INICIAR_DESLOCAMENTO", "IN_DISPLACEMENT", "O técnico iniciou o deslocamento até o local.")}
              className="w-full h-12 bg-indigo-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              🚀 Iniciar Deslocamento
            </button>
          )}

          {visit.status === "IN_DISPLACEMENT" && (
            <button 
              disabled={actionLoading}
              onClick={() => handleStateTransition("INICIAR_ATENDIMENTO", "IN_PROGRESS", "O técnico chegou ao destino e iniciou a O.S.")}
              className="w-full h-12 bg-amber-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              ⚡ Iniciar Atendimento
            </button>
          )}

          {visit.status === "IN_PROGRESS" && (
            <button 
              disabled={actionLoading}
              onClick={() => handleStateTransition("CONCLUIR_VISITA", "COMPLETED", "Visita técnica concluída com sucesso.")}
              className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              ✅ Concluir Ordem de Serviço
            </button>
          )}

          {/* ESTADO TERMINAL TRANCADO */}
          {(visit.status === "COMPLETED" || visit.status === "CANCELED") && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500 font-bold uppercase">
              🔒 Atendimento Encerrado ({visit.status})
            </div>
          )}
        </div>
      </main>
    </div>
  );
}