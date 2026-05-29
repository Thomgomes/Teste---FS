import { useSearchParams } from 'react-router-dom';

export function useVisitFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || '';
  const date = searchParams.get('date') || '';
  const technicianId = searchParams.get('technician_id') || '';

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
    searchParams
  };
}