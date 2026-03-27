import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as gmailApi from '../api/gmail';
import * as whatsappApi from '../api/whatsapp';
import { useAuthStore } from '../store/authStore';
import type { GmailConnectionStatus } from '@shared/types';

export default function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { user, loadUser } = useAuthStore();

  // WhatsApp wizard state
  const [waStep, setWaStep] = useState<1 | 2 | 3>(1);
  const [waPhone, setWaPhone] = useState('');
  const [waCode, setWaCode] = useState(['', '', '', '', '', '']);
  const [waSending, setWaSending] = useState(false);
  const [waVerifying, setWaVerifying] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);
  const [waTesting, setWaTesting] = useState(false);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    loadStatus();

    // Handle OAuth redirect result
    const gmailResult = searchParams.get('gmail');
    if (gmailResult === 'connected') {
      toast.success('Gmail חובר בהצלחה!');
      setSearchParams({});
    } else if (gmailResult === 'error') {
      toast.error('שגיאה בחיבור Gmail: ' + (searchParams.get('message') || ''));
      setSearchParams({});
    }
  }, []);

  async function loadStatus() {
    try {
      const status = await gmailApi.getGmailStatus();
      setGmailStatus(status);
    } catch {
      setGmailStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const url = await gmailApi.getGmailConnectUrl();
      window.location.href = url;
    } catch {
      toast.error('שגיאה ביצירת קישור חיבור');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await gmailApi.disconnectGmail();
      setGmailStatus({ connected: false });
      toast.success('Gmail נותק בהצלחה');
    } catch {
      toast.error('שגיאה בניתוק Gmail');
    } finally {
      setDisconnecting(false);
    }
  }

  const [renewing, setRenewing] = useState(false);

  async function handleRenewWatch() {
    setRenewing(true);
    try {
      await gmailApi.renewGmailWatch();
      await loadStatus();
      toast.success('Watch חודש בהצלחה');
    } catch {
      toast.error('שגיאה בחידוש Watch');
    } finally {
      setRenewing(false);
    }
  }

  function getExpiryInfo(expiration: string | undefined): { text: string; colorClass: string; daysRemaining: number } {
    if (!expiration) return { text: 'לא פעיל', colorClass: 'text-gray-500', daysRemaining: 0 };
    const daysRemaining = Math.ceil((new Date(expiration).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysRemaining <= 0) return { text: 'פג תוקף', colorClass: 'text-red-600', daysRemaining };
    if (daysRemaining <= 7) return { text: `פג תוקף בעוד ${daysRemaining} ימים`, colorClass: 'text-red-600', daysRemaining };
    if (daysRemaining <= 14) return { text: `פג תוקף בעוד ${daysRemaining} ימים`, colorClass: 'text-amber-600', daysRemaining };
    return { text: `פג תוקף בעוד ${daysRemaining} ימים`, colorClass: 'text-green-600', daysRemaining };
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">אינטגרציות</h1>
      <p className="text-gray-500">חבר ערוצים לקליטת חשבוניות אוטומטית</p>

      {/* Gmail Integration */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
              <path d="M20 18H18V9.25L12 13L6 9.25V18H4V6H5.2L12 10.5L18.8 6H20V18Z" fill="#EA4335"/>
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="#EA4335" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">Gmail</h2>
            <p className="text-sm text-gray-500 mt-1">
              קליטת חשבוניות אוטומטית ממיילים של ספקים מוכרים
            </p>

            {gmailStatus?.connected ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-green-700 font-medium">מחובר</span>
                  <span className="text-sm text-gray-500">{gmailStatus.email}</span>
                </div>

                {(() => {
                  const expiry = getExpiryInfo(gmailStatus.watchExpiration);
                  return gmailStatus.watchActive ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        expiry.daysRemaining > 14 ? 'bg-green-500' : expiry.daysRemaining > 7 ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                      <span className={`text-sm font-medium ${expiry.colorClass}`}>{expiry.text}</span>
                      <button
                        onClick={handleRenewWatch}
                        disabled={renewing}
                        className="text-sm text-primary-500 hover:underline disabled:opacity-50"
                      >
                        {renewing ? 'מחדש...' : 'חדש עכשיו'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full" />
                      <span className="text-sm text-yellow-700">Watch לא פעיל</span>
                      <button
                        onClick={handleRenewWatch}
                        disabled={renewing}
                        className="text-sm text-primary-500 hover:underline disabled:opacity-50"
                      >
                        {renewing ? 'מחדש...' : 'חדש עכשיו'}
                      </button>
                    </div>
                  );
                })()}

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  {disconnecting ? 'מנתק...' : 'נתק Gmail'}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="btn-primary"
                >
                  {connecting ? 'מתחבר...' : 'חבר Gmail'}
                </button>
              </div>
            )}
          </div>
        </div>

        {gmailStatus?.connected && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong>איך זה עובד:</strong> כאשר ספק ששמור במערכת שולח מייל עם חשבונית מצורפת (PDF/תמונה),
            החשבונית תיקלט אוטומטית, תעבור חילוץ AI, ותופיע בדף החשבוניות עם סטטוס "ממתין לאישור".
          </div>
        )}
      </div>

      {/* WhatsApp Integration */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.257-.154-2.857.857.857-2.857-.154-.257A8 8 0 1112 20z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">WhatsApp</h2>
            <p className="text-sm text-gray-500 mt-1">
              קליטת חשבוניות ששולחים ספקים ב-WhatsApp
            </p>

            {user?.whatsappVerified && user.whatsappNumber ? (
              /* Connected state */
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-green-700 font-medium">מחובר</span>
                  <span className="text-sm text-gray-500" dir="ltr">{user.whatsappNumber}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setWaTesting(true);
                      try {
                        await whatsappApi.sendTestMessage();
                        toast.success('הודעת בדיקה נשלחה!');
                      } catch { toast.error('שגיאה בשליחת הודעת בדיקה'); }
                      finally { setWaTesting(false); }
                    }}
                    disabled={waTesting}
                    className="text-sm text-primary-500 hover:underline"
                  >
                    {waTesting ? 'שולח...' : 'שלח הודעת בדיקה'}
                  </button>
                  <button
                    onClick={async () => {
                      setWaDisconnecting(true);
                      try {
                        await whatsappApi.disconnectWhatsApp();
                        toast.success('WhatsApp נותק');
                        loadUser();
                      } catch { toast.error('שגיאה'); }
                      finally { setWaDisconnecting(false); }
                    }}
                    disabled={waDisconnecting}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    {waDisconnecting ? 'מנתק...' : 'נתק'}
                  </button>
                </div>
              </div>
            ) : (
              /* Setup wizard */
              <div className="mt-4">
                {/* Step indicators */}
                <div className="flex items-center gap-2 mb-4">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        waStep >= s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>{waStep > s ? '✓' : s}</div>
                      {s < 3 && <div className={`w-8 h-0.5 ${waStep > s ? 'bg-green-500' : 'bg-gray-200'}`} />}
                    </div>
                  ))}
                </div>

                {waStep === 1 && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">מספר ה-WhatsApp העסקי שלך</label>
                    <p className="text-xs text-gray-500">זה המספר שדרכו תקבל התראות וחשבוניות</p>
                    <input
                      type="tel"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      className="input-field"
                      placeholder="050-1234567"
                      dir="ltr"
                    />
                    <button
                      onClick={async () => {
                        setWaSending(true);
                        try {
                          await whatsappApi.startVerification(waPhone);
                          toast.success('קוד אימות נשלח!');
                          setWaStep(2);
                        } catch (err: unknown) {
                          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'שגיאה';
                          toast.error(msg);
                        } finally { setWaSending(false); }
                      }}
                      disabled={waSending || !waPhone.trim()}
                      className="btn-primary w-full min-h-[44px]"
                    >
                      {waSending ? 'שולח...' : 'שלח קוד אימות'}
                    </button>
                  </div>
                )}

                {waStep === 2 && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">הזן את הקוד שקיבלת</label>
                    <div className="flex gap-2 justify-center" dir="ltr">
                      {waCode.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { codeInputRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            const newCode = [...waCode];
                            newCode[i] = val;
                            setWaCode(newCode);
                            if (val && i < 5) codeInputRefs.current[i + 1]?.focus();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !waCode[i] && i > 0) {
                              codeInputRefs.current[i - 1]?.focus();
                            }
                          }}
                          className="w-10 h-12 text-center text-lg font-bold border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                        />
                      ))}
                    </div>
                    <button
                      onClick={async () => {
                        const code = waCode.join('');
                        if (code.length !== 6) { toast.error('יש להזין 6 ספרות'); return; }
                        setWaVerifying(true);
                        try {
                          await whatsappApi.confirmVerification(code);
                          toast.success('WhatsApp אומת בהצלחה!');
                          setWaStep(3);
                          loadUser();
                        } catch (err: unknown) {
                          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'שגיאה';
                          toast.error(msg);
                        } finally { setWaVerifying(false); }
                      }}
                      disabled={waVerifying || waCode.join('').length !== 6}
                      className="btn-primary w-full min-h-[44px]"
                    >
                      {waVerifying ? 'מאמת...' : 'אמת'}
                    </button>
                    <button
                      onClick={() => { setWaStep(1); setWaCode(['', '', '', '', '', '']); }}
                      className="text-sm text-gray-500 hover:underline w-full text-center"
                    >
                      חזור
                    </button>
                  </div>
                )}

                {waStep === 3 && (
                  <div className="text-center space-y-3 py-4">
                    <div className="text-4xl">✅</div>
                    <p className="font-bold text-green-700">!WhatsApp מחובר בהצלחה</p>
                    <p className="text-sm text-gray-500">כשספק שולח לך חשבונית ב-WhatsApp, אנחנו נסרוק אותה אוטומטית</p>
                    <button
                      onClick={async () => {
                        setWaTesting(true);
                        try {
                          await whatsappApi.sendTestMessage();
                          toast.success('הודעת בדיקה נשלחה!');
                        } catch { toast.error('שגיאה בשליחת הודעת בדיקה'); }
                        finally { setWaTesting(false); }
                      }}
                      disabled={waTesting}
                      className="btn-secondary"
                    >
                      {waTesting ? 'שולח...' : 'שלח לי הודעת בדיקה'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="card bg-gray-50">
        <h3 className="font-semibold mb-3">איך עובד תהליך הקליטה האוטומטי?</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-center">
          <div className="p-3">
            <div className="text-2xl mb-2">1</div>
            <div className="font-medium">קבלת מסמך</div>
            <div className="text-gray-500 mt-1">Gmail / WhatsApp</div>
          </div>
          <div className="p-3">
            <div className="text-2xl mb-2">2</div>
            <div className="font-medium">זיהוי ספק</div>
            <div className="text-gray-500 mt-1">לפי אימייל / טלפון</div>
          </div>
          <div className="p-3">
            <div className="text-2xl mb-2">3</div>
            <div className="font-medium">חילוץ AI</div>
            <div className="text-gray-500 mt-1">Claude מחלץ פריטים</div>
          </div>
          <div className="p-3">
            <div className="text-2xl mb-2">4</div>
            <div className="font-medium">השוואת מחירים</div>
            <div className="text-gray-500 mt-1">מול הסכמי מחיר</div>
          </div>
        </div>
      </div>
    </div>
  );
}
