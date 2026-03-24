import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as gmailApi from '../api/gmail';
import type { GmailConnectionStatus } from '@shared/types';

export default function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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

  async function handleRenewWatch() {
    try {
      await gmailApi.renewGmailWatch();
      await loadStatus();
      toast.success('Watch חודש בהצלחה');
    } catch {
      toast.error('שגיאה בחידוש Watch');
    }
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

                {gmailStatus.watchActive ? (
                  <div className="text-sm text-gray-500">
                    Watch פעיל עד {new Date(gmailStatus.watchExpiration!).toLocaleDateString('he-IL')}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full" />
                    <span className="text-sm text-yellow-700">Watch לא פעיל</span>
                    <button onClick={handleRenewWatch} className="text-sm text-primary-500 hover:underline">
                      חדש עכשיו
                    </button>
                  </div>
                )}

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

            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 space-y-2">
              <p><strong>הגדרה:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>צור חשבון Twilio והגדר WhatsApp Sandbox</li>
                <li>הגדר את ה-Webhook URL ב-Twilio:</li>
              </ol>
              <code className="block p-2 bg-white rounded border text-xs font-mono text-left" dir="ltr">
                POST {window.location.origin}/api/webhooks/whatsapp
              </code>
              <ol className="list-decimal list-inside space-y-1 text-gray-600" start={3}>
                <li>הוסף את משתני הסביבה ב-Vercel: <code className="text-xs">TWILIO_ACCOUNT_SID</code>, <code className="text-xs">TWILIO_AUTH_TOKEN</code></li>
                <li>ודא שמספרי הטלפון של הספקים מעודכנים במערכת</li>
              </ol>
            </div>
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
