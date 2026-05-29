import { useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge";

export default function VisitRow({ visit }) {
  const navigate = useNavigate();

  const handleRowClick = () => {
    navigate(`/visits/${visit.id}`);
  };

  return (
    <>
      {/* MODO MOBILE*/}
      <div
        onClick={handleRowClick}
        className="block md:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs mb-3 active:bg-slate-50 cursor-pointer transition-colors"
      >
        <div className="flex justify-between items-start gap-2 mb-2">
          <span className="font-bold text-slate-900 text-sm line-clamp-1">
            {visit.client_name}
          </span>
          <StatusBadge status={visit.status} />
        </div>

        <p className="text-xs text-slate-500 line-clamp-1 mb-3">
          📍 {visit.address}
        </p>

        <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">
            {visit.technician?.name}
          </span>
          <span className="font-medium text-slate-500">
            {new Date(visit.scheduled_at).toLocaleDateString("pt-BR")}
          </span>
        </div>
      </div>

      {/* MODO DESKTOP*/}
      <tr
        onClick={handleRowClick}
        className="hidden md:table-row border-b border-slate-200 hover:bg-slate-50/80 transition-colors cursor-pointer text-sm"
      >
        <td className="px-6 py-4 font-semibold text-slate-900 max-w-xs truncate">
          {visit.client_name}
        </td>
        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
          {visit.address}
        </td>
        <td className="px-6 py-4 text-slate-600 font-medium">
          {visit.technician?.name}
        </td>
        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
          {new Date(visit.scheduled_at).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <StatusBadge status={visit.status} />
        </td>
      </tr>
    </>
  );
}
