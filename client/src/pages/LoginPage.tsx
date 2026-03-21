import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import * as authApi from '../api/auth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginToken, setLoginToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login({ username, password });
      setLoginToken(res.loginToken);
      setMaskedPhone(res.maskedPhone);
      setDevOtp(res.dev_otp || null);
      setStep('otp');
      toast.success('קוד אימות נשלח');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.verifyLogin({ loginToken, otpCode });
      setAuth(res.token, res.user);
      navigate('/app/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'קוד שגוי');
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
          {step === 'credentials' ? (
            <>
              <h2 className="text-xl font-semibold mb-6">התחברות</h2>
              <form onSubmit={handleCredentials} className="space-y-4">
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
                  {loading ? 'בודק...' : 'המשך'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-2">אימות דו-שלבי</h2>
              <p className="text-sm text-gray-500 mb-4">
                קוד אימות נשלח למספר {maskedPhone}
              </p>

              {/* Dev mode OTP banner */}
              {devOtp && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
                  <p className="text-xs text-yellow-600 font-medium">מצב פיתוח</p>
                  <p className="text-lg font-bold text-yellow-800 tracking-widest text-center mt-1" dir="ltr">
                    {devOtp}
                  </p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">קוד אימות (6 ספרות)</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input-field text-center text-2xl tracking-[0.5em]"
                    placeholder="------"
                    maxLength={6}
                    required
                    dir="ltr"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">הקוד תקף ל-5 דקות</p>
                </div>
                <button type="submit" disabled={loading || otpCode.length !== 6} className="btn-primary w-full">
                  {loading ? 'מאמת...' : 'התחבר'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setOtpCode(''); setLoginToken(''); setDevOtp(null); }}
                  className="btn-secondary w-full"
                >
                  חזרה
                </button>
              </form>
            </>
          )}
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
