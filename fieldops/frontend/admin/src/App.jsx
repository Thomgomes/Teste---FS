import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VisitDetail from "./pages/VisitDetail";
import ClientPage from "./pages/ClientPage";

// Componente de Guarda de Rota para proteger o Painel Admin
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("fieldops_token");
  const user = localStorage.getItem("fieldops_user");

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  const parsedUser = JSON.parse(user);
  if (parsedUser.role !== "admin") {
    localStorage.clear();
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota Pública: Entrada */}
        <Route path="/" element={<Login />} />

        <Route path="/v/:token" element={<ClientPage />} />
        {/* Rotas Privadas e Protegidas para o Administrador */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/visits/:id"
          element={
            <ProtectedRoute>
              <VisitDetail />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
