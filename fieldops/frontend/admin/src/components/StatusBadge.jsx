export default function StatusBadge({ status }) {
  // Mapeamento de estilos baseado no enum vindo do banco de dados do Python
  const config = {
    AGENDADA: {
      text: "Agendada",
      styles: "bg-indigo-50 text-indigo-700 border-indigo-100",
    },
    EM_DESLOCAMENTO: {
      text: "Em Deslocamento",
      styles: "bg-amber-50 text-amber-700 border-amber-100",
    },
    EM_ATENDIMENTO: {
      text: "Em Atendimento",
      styles: "bg-sky-50 text-sky-700 border-sky-100",
    },
    CONCLUIDA: {
      text: "Concluída",
      styles: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
    CANCELADA: {
      text: "Cancelada",
      styles: "bg-rose-50 text-rose-700 border-rose-100",
    },
  };

  const current = config[status] || {
    text: status,
    styles: "bg-slate-50 text-slate-600 border-slate-100",
  };
  
  return (
    <span
      className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${current.styles} whitespace-nowrap`}
    >
      {current.text}
    </span>
  );
}
