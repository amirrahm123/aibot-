import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import * as authApi from '../api/auth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login({ username, password });
      setAuth(res.token, res.user);
      navigate('/app/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-500">שומר המחיר</h1>
          <p className="text-gray-500 mt-2">מערכת בדיקת מחירי חשבוניות חכמה</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-6">התחברות</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם משתמש</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="username"
                required
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="--------"
                required
                dir="ltr"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'מתחבר...' : 'התחבר'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            אין לך חשבון?{' '}
            <Link to="/register" className="text-primary-500 hover:underline">
              הרשם כאן
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
