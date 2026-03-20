import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import * as authApi from '../api/auth';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.register({ username, password, businessName, ownerName, phone });
      setDevOtp(res.dev_otp || null);
      setStep('otp');
      toast.success('קוד אימות נשלח לטלפון');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בהרשמה');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.verifyRegister({
        username, password, businessName, ownerName, phone, otpCode,
      });
      setAuth(res.token, res.user);
      navigate('/dashboard');
      toast.success('ברוך הבא!');
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
          <p className="text-gray-500 mt-2">הרשמה למערכת</p>
        </div>

        <div className="card">
          {step === 'form' ? (
            <>
              <h2 className="text-xl font-semibold mb-6">יצירת חשבון</h2>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם העסק *</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="input-field"
                    placeholder="למשל: מסעדת השף"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="input-field"
                    placeholder="שם בעל העסק"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם משתמש *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    placeholder="לפחות 6 תווים"
                    required
                    minLength={6}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">טלפון נייד *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field"
                    placeholder="05X-XXXXXXX"
                    required
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-400 mt-1">נשלח קוד אימות SMS למספר זה</p>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'שולח קוד...' : 'שלח קוד אימות'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-2">אימות טלפון</h2>
              <p className="text-sm text-gray-500 mb-4">קוד אימות נשלח ל-{phone}</p>

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
                  {loading ? 'מאמת...' : 'אמת והרשם'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtpCode(''); setDevOtp(null); }}
                  className="btn-secondary w-full"
                >
                  חזרה
                </button>
              </form>
            </>
          )}
          <p className="text-center text-sm text-gray-500 mt-4">
            כבר יש לך חשבון?{' '}
            <Link to="/login" className="text-primary-500 hover:underline">
              התחבר כאן
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
