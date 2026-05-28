/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import VisitRow from "../components/VisitRow";

export default function Dashboard() {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem("fieldops_user") || "{}");

  // Estados de dados da API
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estados dos Filtros Reativos (Mobile-First)
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Carrega as visitas aplicando os filtros reativos via Query Params
  useEffect(() => {
    let isMounted = true;

    async function fetchVisits() {
      setLoading(true);
      setError("");
      try {
        // Monta a query string dinamicamente
        const params = new URLSearchParams();
        if (statusFilter) params.append("status", statusFilter);
        if (dateFilter) params.append("date", dateFilter);

        const queryString = params.toString() ? `?${params.toString()}` : "";
        const endpoint = queryString ? `/visits${queryString}` : "/visits";
        const data = await api.request(endpoint);

        if (isMounted) {
          setVisits(data);
        }
      } catch (err) {
        if (isMounted) {
          setError("Não foi possível carregar a grade de visitas.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchVisits();

    return () => {
      isMounted = false;
    };
  }, [statusFilter, dateFilter]); // Reexecuta imediatamente ao mudar qualquer filtro

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 🔝 HEADER: Totalmente responsivo */}
      <header className="bg-white border-b border-slate-200 min-h-16 flex flex-col sm:flex-row items-center justify-between px-6 py-3 sm:py-0 gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <span className="text-xl font-black text-indigo-600 tracking-tight">
            FieldOps
          </span>
          <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-100">
            Painel Admin
          </span>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <span className="text-sm font-semibold text-slate-600">
            Olá, {storedUser.name}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
          >
            Sair
          </button>
        </div>
      </header>

      {/* 🎛️ PAINEL PRINCIPAL */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* TÍTULO E AÇÃO CRIAÇÃO */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight md:text-2xl">
              Gestão de Ordens de Campo
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-0.5">
              Acompanhamento de SLAs e alocação de técnicos em tempo real.
            </p>
          </div>
          <button
            className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl px-5 transition-colors shadow-md shadow-indigo-100 cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto"
            onClick={() => alert("Próxima feature: Modal de criação")}
          >
            <span>➕ Nova Visita</span>
          </button>
        </div>

        {/* 🔍 BARRA DE FILTROS REATIVOS (Mobile-First: Empilha no celular, alinha no desktop) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Filtrar por Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
            >
              <option value="">Todos os Status</option>
              <option value="SCHEDULED">Agendada</option>
              <option value="IN_DISPLACEMENT">Em Deslocamento</option>
              <option value="IN_PROGRESS">Em Atendimento</option>
              <option value="COMPLETED">Concluída</option>
              <option value="CANCELED">Cancelada</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Filtrar por Data Específica
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* 📊 CONTEÚDO / LISTAGEM */}
        {error ? (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm p-4 rounded-xl font-medium text-center">
            {error}
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
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
              Sincronizando grade...
            </span>
          </div>
        ) : visits.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-xs">
            <p className="text-slate-400 font-medium text-sm">
              Nenhuma ordem de serviço localizada para o filtro selecionado.
            </p>
          </div>
        ) : (
          /* CONTAINER RESPONSIVO MESTRE */
          <div className="w-full">
            {/* 📱 Lista de Cards: Visível apenas no Celular */}
            <div className="block md:hidden">
              {visits.map((visit) => (
                <VisitRow key={visit.id} visit={visit} />
              ))}
            </div>

            {/* 💻 Tabela Estruturada: Visível apenas a partir de telas Médias (Desktop) */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-3.5">Cliente</th>
                    <th className="px-6 py-3.5">Endereço de Atendimento</th>
                    <th className="px-6 py-3.5">Técnico Designado</th>
                    <th className="px-6 py-3.5">Janela Prevista</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visits.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
