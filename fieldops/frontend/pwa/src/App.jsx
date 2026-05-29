import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import VisitsList from "./pages/VisitsList";
import VisitDetail from "./pages/VisitDetail";

function GuardedRoute({ children }) {
  const token = localStorage.getItem("tech_token");
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota Pública: Tela de Acesso Mobile */}
        <Route path="/" element={<Login />} />

        {/* Rotas Protegidas do Técnico de Campo */}
        <Route 
          path="/visitas" 
          element={
            <GuardedRoute>
              <VisitsList />
            </GuardedRoute>
          } 
        />
        
        <Route 
          path="/visitas/:id" 
          element={
            <GuardedRoute>
              <VisitDetail />
            </GuardedRoute>
          } 
        />

        {/* Fallback de Segurança */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}