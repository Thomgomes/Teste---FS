import { useSearchParams } from 'react-router-dom';

export function useVisitFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Captura os valores brutos direto da barra de endereço
  const status = searchParams.get('status') || '';
  const date = searchParams.get('date') || '';
  const technicianId = searchParams.get('technician_id') || '';

  // Função genérica que atualiza ou remove os parâmetros da URL
  const setFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return {
    filters: { status, date, technicianId },
    queryString: searchParams.toString() ? `?${searchParams.toString()}` : '',
    setFilter,
    clearAllFilters,
    searchParams // Expõe o objeto caso o useEffect precise escutá-lo
  };
}