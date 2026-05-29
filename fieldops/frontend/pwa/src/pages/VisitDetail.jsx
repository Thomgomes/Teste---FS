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
  const [photos, setPhotos] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    api
      .request("/visits/")
      .then((list) => {
        const match = list.find((v) => v.id === id);
        if (match) setVisit(match);
        else setError("Visita não localizada.");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePhotosChange = (e) => {
    const files = Array.from(e.target.files);
    const MAX = 20;
    const remaining = MAX - photos.length;
    const toAdd = files.slice(0, remaining);

    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos((prev) => [
          ...prev,
          { file, preview: reader.result, base64: reader.result },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotosOnline = async (visitId) => {
    for (const photo of photos) {
      try {
        await api.uploadPhoto(visitId, photo.file, photo.file.name);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const enqueuePhotosOffline = (visitId) => {
    if (photos.length === 0) return;

    const queueKey = api.getQueueKey();
    const currentQueue = JSON.parse(localStorage.getItem(queueKey) || "[]");

    photos.forEach((photo) => {
      currentQueue.push({
        _type: "PHOTO_UPLOAD",
        visit_id: visitId,
        base64: photo.base64,
        filename: photo.file.name,
        idempotency_key: `photo-${crypto.randomUUID()}`,
        created_at: new Date().toISOString(),
      });
    });

    localStorage.setItem(queueKey, JSON.stringify(currentQueue));
  };

  const handleStateTransition = async (
    eventType,
    statusToApply,
    defaultDescription,
  ) => {
    setActionLoading(true);

    const finalDescription =
      statusToApply === "COMPLETED"
        ? notes || defaultDescription
        : defaultDescription;

    const actionPayload = {
      visit_id: id,
      event_type: eventType,
      description: finalDescription,
      photo: null,
      idempotency_key: `idemp-tech-${crypto.randomUUID()}`,
      created_at: new Date().toISOString().replace("Z", ""),
      status_to_apply: statusToApply,
    };

    const queueKey = api.getQueueKey();

    if (navigator.onLine) {
      try {
        await api.request("/sync/", {
          method: "POST",
          body: JSON.stringify({ events: [actionPayload] }),
        });

        if (photos.length > 0) {
          await uploadPhotosOnline(id);
        }

        setVisit((prev) => ({ ...prev, status: statusToApply }));
        setPhotos([]);

        const photoMsg =
          photos.length > 0 ? ` + ${photos.length} foto(s) enviada(s).` : "";

        alert(`Status atualizado e sincronizado com o servidor com sucesso!${photoMsg}`);
      } catch (err) {
        console.error(err);
        alert(`Erro de validação da API: ${err.message}`);
      } finally {
        setActionLoading(false);
      }
    } else {
      const currentQueue = JSON.parse(localStorage.getItem(queueKey) || "[]");
      currentQueue.push(actionPayload);
      localStorage.setItem(queueKey, JSON.stringify(currentQueue));

      enqueuePhotosOffline(id);

      setVisit((prev) => ({ ...prev, status: statusToApply }));

      const photoMsg =
        photos.length > 0
          ? ` + ${photos.length} foto(s) salva(s) para sincronização.`
          : "";

      alert(
        `Sem sinal. Relatório de texto salvo localmente para sincronização automática.${photoMsg}`,
      );

      setPhotos([]);
      setActionLoading(false);
    }
  };

  if (loading)
    return (
      <p className="p-6 text-xs text-slate-400 font-bold text-center">
        Buscando detalhes...
      </p>
    );

  if (error || !visit)
    return (
      <p className="p-6 text-xs text-rose-600 font-bold text-center">{error}</p>
    );

  let rawStatus = (visit.status || "").toUpperCase();
  let textFriendly = visit.status;

  if (rawStatus === "AGENDADA" || rawStatus === "SCHEDULED") {
    rawStatus = "SCHEDULED";
    textFriendly = "AGENDADA";
  }
  if (rawStatus === "EM_DESLOCAMENTO" || rawStatus === "IN_DISPLACEMENT") {
    rawStatus = "IN_DISPLACEMENT";
    textFriendly = "EM DESLOCAMENTO";
  }
  if (
    rawStatus === "EM_ATENDIMENTO" ||
    rawStatus === "EM_ANDAMENTO" ||
    rawStatus === "IN_PROGRESS"
  ) {
    rawStatus = "IN_PROGRESS";
    textFriendly = "EM ATENDIMENTO";
  }
  if (rawStatus === "CONCLUIDA" || rawStatus === "COMPLETED") {
    rawStatus = "COMPLETED";
    textFriendly = "CONCLUÍDA";
  }
  if (rawStatus === "CANCELADA" || rawStatus === "CANCELED") {
    rawStatus = "CANCELED";
    textFriendly = "CANCELADA";
  }

  const queueKey = api.getQueueKey();
  const currentQueue = JSON.parse(localStorage.getItem(queueKey) || "[]");
  const localMatch = currentQueue.filter((e) => e.visit_id === visit.id);

  if (localMatch.length > 0) {
    const lastLocal = localMatch[localMatch.length - 1];
    if (lastLocal.status_to_apply) {
      const lastLocalStatus = lastLocal.status_to_apply.toUpperCase();
      if (lastLocalStatus === "SCHEDULED") rawStatus = "SCHEDULED";
      if (lastLocalStatus === "IN_DISPLACEMENT") rawStatus = "IN_DISPLACEMENT";
      if (lastLocalStatus === "IN_PROGRESS") rawStatus = "IN_PROGRESS";
      if (lastLocalStatus === "COMPLETED") rawStatus = "COMPLETED";
      if (lastLocalStatus === "CANCELED") rawStatus = "CANCELED";
    }
  }

  const pendingPhotos = currentQueue.filter(
    (e) => e._type === "PHOTO_UPLOAD" && e.visit_id === id,
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <OfflineIndicator />

      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 gap-3">
        <button
          onClick={() => navigate("/visitas")}
          className="text-slate-400 text-sm font-bold cursor-pointer"
        >
          ⬅️ Voltar
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-xs font-black text-slate-500 uppercase">
          Ordem de Serviço
        </span>

        {pendingPhotos > 0 && (
          <span className="ml-auto text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
            📸 {pendingPhotos} foto(s) na fila
          </span>
        )}
      </header>

      <main className="p-4 flex-1 flex flex-col justify-between space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase">
              {textFriendly}
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-2">
              {visit.client_name}
            </h2>
            <p className="text-xs font-medium text-slate-500 mt-1">
              📍 {visit.address}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
            📅 Janela: {new Date(visit.scheduled_at).toLocaleString("pt-BR")}
          </div>

          {visit.public_token &&
            (() => {
              const clientUrl = `http://localhost:3000/v/${visit.public_token}`;
              return (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2 shadow-xs">
                  <h4 className="text-[9px] font-black text-indigo-500 uppercase tracking-wider">
                    🔗 Link de Acompanhamento do Cliente
                  </h4>

                  <p className="text-[10px] font-mono text-indigo-700 break-all bg-white border border-indigo-100 rounded-xl px-3 py-2">
                    {clientUrl}
                  </p>

                  <button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(clientUrl)
                        .then(() => {
                          alert(
                            "Link copiado! Envie para o cliente via WhatsApp ou SMS.",
                          );
                        })
                        .catch(() => {
                          alert(
                            "Não foi possível copiar automaticamente. Copie manualmente:\n\n" +
                              clientUrl,
                          );
                        });
                    }}
                    className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Copiar Link
                  </button>
                </div>
              );
            })()}
        </div>

        {rawStatus === "IN_PROGRESS" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Relatório de Atendimento
            </h4>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                Observações Técnicas
              </label>
              <textarea
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-medium h-20 resize-none"
                placeholder="Relate os procedimentos ou peças trocadas..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                Anexar Fotos Comprovantes ({photos.length}/20)
              </label>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotosChange}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
              />

              {photos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border border-slate-200 h-24 bg-slate-100 flex items-center justify-center"
                    >
                      <img
                        src={photo.preview}
                        alt={`Preview visual ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!navigator.onLine && photos.length > 0 && (
                <p className="mt-2 text-[10px] font-bold text-amber-600">
                  Essas fotos serão enviadas quando a conexão voltar.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {rawStatus === "SCHEDULED" && (
            <button
              disabled={actionLoading}
              onClick={() =>
                handleStateTransition(
                  "INICIAR_DESLOCAMENTO",
                  "IN_DISPLACEMENT",
                  "O técnico iniciou o deslocamento.",
                )
              }
              className="w-full h-12 bg-indigo-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              {actionLoading ? "Processando..." : "🚀 Iniciar Deslocamento"}
            </button>
          )}

          {rawStatus === "IN_DISPLACEMENT" && (
            <button
              disabled={actionLoading}
              onClick={() =>
                handleStateTransition(
                  "INICIAR_ATENDIMENTO",
                  "IN_PROGRESS",
                  "O técnico chegou ao destino.",
                )
              }
              className="w-full h-12 bg-amber-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              {actionLoading ? "Processando..." : "⚡ Iniciar Atendimento"}
            </button>
          )}

          {rawStatus === "IN_PROGRESS" && (
            <button
              disabled={actionLoading}
              onClick={() =>
                handleStateTransition(
                  "CONCLUIR_VISITA",
                  "COMPLETED",
                  notes || "Visita técnica concluída.",
                )
              }
              className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              {actionLoading
                ? "Processando..."
                : "✅ Concluir Ordem de Serviço"}
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