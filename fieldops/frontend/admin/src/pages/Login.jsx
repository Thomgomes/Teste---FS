import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('fieldops_token');
    const user = localStorage.getItem('fieldops_user');
    if (token && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await api.login(email, password);
      
      if (data.role !== 'admin') {
        throw new Error('Acesso recusado. Este painel é restrito para administradores.');
      }

      localStorage.setItem('fieldops_token', data.access_token);
      localStorage.setItem('fieldops_user', JSON.stringify({ name: data.name, role: data.role }));
      
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-8 transition-all duration-200">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-indigo-600 tracking-tight">FieldOps</h1>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            Central Administrativa de Equipes de Campo
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm p-4 rounded-xl mb-6 font-semibold animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              E-mail Corporativo
            </label>
            <input
              type="email"
              required
              placeholder="admin@fieldops.com.br"
              className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-inner disabled:opacity-60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Senha de Acesso
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-inner disabled:opacity-60"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl text-sm transition-colors shadow-md shadow-indigo-100 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Autenticando...</span>
              </div>
            ) : (
              'Entrar no Painel'
            )}
          </button>
        </form>

      </div>
    </div>
  );
}