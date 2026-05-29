import { useState, useEffect } from "react";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (isOnline) return null; // Se estiver online, não polui a tela do celular

  return (
    <div className="bg-amber-500 text-white text-[11px] font-black uppercase tracking-wider text-center py-1.5 px-4 sticky top-0 z-50 animate-pulse flex items-center justify-center gap-1.5 shadow-sm">
      <span>⚠️ Modo Offline Ativo</span>
      <span className="opacity-75 font-medium block sm:inline">| Operando sob o cache do dispositivo</span>
    </div>
  );
}