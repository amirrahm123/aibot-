import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DashboardStats, IInvoice, ISupplier, IUserUsage, SavingsData, SupplierRisk } from '@shared/types';
import * as invoicesApi from '../api/invoices';
import * as suppliersApi from '../api/suppliers';
import * as analyticsApi from '../api/analytics';
import * as subscriptionApi from '../api/subscription';
import { useAuthStore } from '../store/authStore';

const HEBREW_MONTHS: Record<string, string> = {
  '01': 'ינואר', '02': 'פברואר', '03': 'מרץ', '04': 'אפריל',
  '05': 'מאי', '06': 'יוני', '07': 'יולי', '08': 'אוגוסט',
  '09': 'ספטמבר', '10': 'אוקטובר', '11': 'נובמבר', '12': 'דצמבר',
};

function riskBadge(score: number) {
  if (score >= 60) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">גבוה</span>;
  if (score >= 30) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">בינוני</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">נמוך</span>;
}

function formatAgorot(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2)}`;
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="h-8 skeleton w-32 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card !p-4 md:!p-6">
            <div className="h-4 skeleton w-20 mb-3" />
            <div className="h-8 skeleton w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card"><div className="h-5 skeleton w-48 mb-4" /><div className="h-[250px] skeleton" /></div>
        <div className="card"><div className="h-5 skeleton w-48 mb-4" /><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 skeleton" />)}</div></div>
      </div>
      <div className="card"><div className="h-5 skeleton w-40 mb-4" /><div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 skeleton" />)}</div></div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<IInvoice[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<IInvoice[]>([]);
  const [suppliersWithoutAgreements, setSuppliersWithoutAgreements] = useState(0);
  const [savings, setSavings] = useState<SavingsData | null>(null);
  const [riskSuppliers, setRiskSuppliers] = useState<SupplierRisk[]>([]);
  const [usage, setUsage] = useState<IUserUsage | null>(null);
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, loadUser } = useAuthStore();

  useEffect(() => {
    const load = async () => {
      try {
        const [dashStats, invs, pending, suppliers, savingsData, riskData, usageData] = await Promise.all([
          invoicesApi.getDashboardStats(),
          invoicesApi.getInvoices({ limit: 10 }),
          invoicesApi.getInvoices({ pendingOnly: true, limit: 20 }),
          suppliersApi.getSuppliers(),
          analyticsApi.getSavings(6).catch(() => null),
          analyticsApi.getSupplierRisk().catch(() => []),
          invoicesApi.getUsageStatus().catch(() => null),
        ]);
        setStats(dashStats);
        setRecentInvoices(invs.data);
        setPendingInvoices(pending.data);
        setSuppliersWithoutAgreements(
          suppliers.filter((s: ISupplier) => s.isActive && (s.agreementCount || 0) === 0).length
        );
        setSavings(savingsData);
        setRiskSuppliers(riskData);
        setUsage(usageData);
      } catch {
        toast.error('שגיאה בטעינת נתונים');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!stats) return null;

  const trendData = stats.overchargeTrend.map((d) => ({
    date: new Date(d.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }),
    amount: d.amount / 100,
  }));

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">דשבורד</h1>
        <button
          onClick={() => navigate('/app/invoices')}
          className="bg-primary-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          סרוק חשבונית עם AI
        </button>
      </div>

      {/* Pending invoices alert */}
      {pendingInvoices.length > 0 && (
        <div className="mb-6 space-y-3">
          {/* General pending alert */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">&#9888;</span>
              <div>
                <p className="font-bold text-amber-800">
                  {pendingInvoices.length === 1
                    ? 'יש חשבונית אחת שלא נבדקה'
                    : `יש ${pendingInvoices.length} חשבוניות שלא נבדקו`}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  חשבוניות שהתקבלו אוטומטית דרך Gmail וממתינות לאישורך
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/app/invoices?pendingOnly=true')}
              className="bg-amber-500 text-white px-5 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors text-sm whitespace-nowrap min-h-[44px]"
            >
              בדוק עכשיו
            </button>
          </div>

          {/* Individual overcharge alerts for pending invoices */}
          {pendingInvoices
            .filter(inv => inv.totalOverchargeAmount > 0)
            .map(inv => (
              <div
                key={inv._id}
                onClick={() => navigate(`/app/invoices/${inv._id}`)}
                className="bg-red-50 border border-red-300 rounded-xl p-4 cursor-pointer hover:bg-red-100 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">&#128680;</span>
                    <div>
                      <p className="font-bold text-red-800">
                        חריגת מחיר: {inv.supplierName || 'ספק'}
                        {inv.invoiceNumber ? ` — חשבונית ${inv.invoiceNumber}` : ''}
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        נמצאו {inv.overchargeCount} פריטים חורגים — סה״כ חריגה של{' '}
                        <strong dir="ltr">{formatAgorot(inv.totalOverchargeAmount)}</strong>
                        {' '}מעבר למחיר המוסכם
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-red-500 font-medium whitespace-nowrap">לחץ לפרטים &larr;</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* No-agreements banner */}
      {suppliersWithoutAgreements > 3 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <p className="font-bold text-amber-800">
                יש לך {suppliersWithoutAgreements} ספקים ללא הסכמי מחיר
              </p>
              <p className="text-sm text-amber-700 mt-1">
                הגדר הסכמים כדי שנוכל לאתר חריגות מחיר אוטומטית
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/app/suppliers')}
            className="bg-amber-500 text-white px-5 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors text-sm whitespace-nowrap min-h-[44px]"
          >
            הגדר הסכמים
          </button>
        </div>
      )}

      {/* Free tier usage bar */}
      {usage?.isFree && (
        <div className="card !p-4 mb-6 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">חשבוניות החודש: {usage.invoicesIngested}/{usage.invoiceLimit}</span>
              <button onClick={() => navigate('/app/pricing')} className="text-xs text-primary-500 hover:underline">שדרג</button>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  usage.invoicesIngested >= usage.invoiceLimit ? 'bg-red-500' :
                  usage.invoicesIngested >= usage.invoiceLimit * 0.8 ? 'bg-amber-500' :
                  'bg-primary-500'
                }`}
                style={{ width: `${Math.min((usage.invoicesIngested / usage.invoiceLimit) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">סריקות AI: {usage.aiScansUsed}/{usage.scanLimit}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  usage.aiScansUsed >= usage.scanLimit ? 'bg-red-500' :
                  usage.aiScansUsed >= usage.scanLimit * 0.8 ? 'bg-amber-500' :
                  'bg-primary-500'
                }`}
                style={{ width: `${Math.min((usage.aiScansUsed / usage.scanLimit) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pro trial banner for free users */}
      {user?.plan === 'free' && !user.isTrial && !trialBannerDismissed && (
        <div className="bg-gradient-to-l from-primary-500 to-blue-600 text-white rounded-xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="font-bold">נסה פרו בחינם ל-14 יום</p>
            <p className="text-sm text-white/80 mt-1">התראות WhatsApp, דשבורד מתקדם וייצוא דו"חות — בלי כרטיס אשראי</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setStartingTrial(true);
                try {
                  await subscriptionApi.startTrial();
                  toast.success('הניסיון החינמי התחיל!');
                  loadUser();
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : 'שגיאה';
                  toast.error(msg);
                } finally {
                  setStartingTrial(false);
                }
              }}
              disabled={startingTrial}
              className="bg-white text-primary-500 px-5 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors text-sm whitespace-nowrap min-h-[44px]"
            >
              {startingTrial ? 'מתחיל...' : 'התחל ניסיון חינם'}
            </button>
            <button
              onClick={() => setTrialBannerDismissed(true)}
              className="text-white/60 hover:text-white p-2"
              title="סגור"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Stats cards — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="card card-hover !p-4 md:!p-6">
          <p className="text-xs md:text-sm text-gray-500">חשבוניות החודש</p>
          <p className="text-2xl md:text-3xl font-bold mt-1">{stats.totalInvoices}</p>
        </div>
        <div className="card card-hover !p-4 md:!p-6 border-danger-200">
          <p className="text-xs md:text-sm text-gray-500">סה״כ חריגות החודש</p>
          <p className="text-xl md:text-3xl font-bold mt-1 text-danger-500" dir="ltr">{formatAgorot(stats.totalOverchargeAmount)}</p>
        </div>
        <div className="card card-hover !p-4 md:!p-6">
          <p className="text-xs md:text-sm text-gray-500">פריטים חורגים</p>
          <p className="text-2xl md:text-3xl font-bold mt-1">{stats.overchargeCount}</p>
        </div>
        <div className="card card-hover !p-4 md:!p-6">
          <p className="text-xs md:text-sm text-gray-500">ספקים פעילים</p>
          <p className="text-2xl md:text-3xl font-bold mt-1 text-primary-500">{stats.activeSupplierCount}</p>
        </div>
      </div>

      {/* Savings trend chart */}
      <div className="card mb-6 md:mb-8">
        <h2 className="text-lg font-semibold mb-4">חסכון לאורך זמן</h2>
        {savings && savings.monthly.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={savings.monthly.map((m) => ({
                month: HEBREW_MONTHS[m.month.split('-')[1]] || m.month,
                amount: m.totalOvercharge / 100,
                proCost: 99,
              })).reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} reversed />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value: number, name: string) => [
                  `₪${value.toFixed(2)}`,
                  name === 'amount' ? 'חריגות שנתפסו' : 'עלות תוכנית Pro',
                ]} />
                <ReferenceLine y={99} stroke="#94a3b8" strokeDasharray="6 4" label={{ value: 'Pro ₪99/חודש', position: 'insideTopRight', fontSize: 11, fill: '#94a3b8' }} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="amount" />
              </BarChart>
            </ResponsiveContainer>
            <div className="text-center mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">סך הכל חסכת</p>
              <p className="text-2xl md:text-3xl font-bold text-primary-500 mt-1" dir="ltr">
                {formatAgorot(savings.lifetimeTotal)}
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🛡️</div>
            <p className="text-gray-500 text-sm">עדיין לא זוהו חריגות — המערכת עובדת ושומרת על המחירים שלך</p>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Overcharge trend */}
        {trendData.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">מגמת חריגות — 30 ימים אחרונים</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value: number) => [`₪${value.toFixed(2)}`, 'סכום חריגה']} />
                <Bar dataKey="amount" fill="#e02424" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* At-risk suppliers */}
        {riskSuppliers.length > 0 ? (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">ספקים בסיכון</h2>
            <div className="space-y-3">
              {riskSuppliers.slice(0, 3).map((s) => (
                <div
                  key={s.supplierId}
                  onClick={() => navigate('/app/suppliers')}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{s.supplierName}</p>
                        {riskBadge(s.riskScore)}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5" title={s.explanation}>
                        {s.overchargeCount} חריגות מתוך {s.totalInvoices} חשבוניות
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-danger-500 ms-3" dir="ltr">{formatAgorot(s.totalOvercharge)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Fallback: top overcharging suppliers from dashboard stats */
          stats.topOverchargingSuppliers.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">ספקים חורגים מובילים</h2>
              <div className="space-y-3">
                {stats.topOverchargingSuppliers.map((s, i) => (
                  <div key={s.supplierId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                      <div>
                        <p className="font-medium">{s.supplierName}</p>
                        <p className="text-xs text-gray-500">{s.invoiceCount} חשבוניות</p>
                      </div>
                    </div>
                    <span className="font-bold text-danger-500" dir="ltr">{formatAgorot(s.totalOvercharge)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Recent invoices */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">חשבוניות אחרונות</h2>
          <button onClick={() => navigate('/app/invoices')} className="text-sm text-primary-500 hover:underline">
            הצג הכל →
          </button>
        </div>
        {recentInvoices.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-gray-500 text-sm">אין חשבוניות עדיין</p>
            <button onClick={() => navigate('/app/invoices')} className="text-sm text-primary-500 hover:underline mt-2">
              העלה חשבונית ראשונה →
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="desktop-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-gray-500">
                    <th className="text-right py-2">תאריך</th>
                    <th className="text-right py-2">ספק</th>
                    <th className="text-right py-2">מס׳ חשבונית</th>
                    <th className="text-right py-2">סה״כ</th>
                    <th className="text-right py-2">חריגה</th>
                    <th className="text-right py-2">פריטים חורגים</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr
                      key={inv._id}
                      onClick={() => navigate(`/app/invoices/${inv._id}`)}
                      className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${inv.overchargeCount > 0 ? 'bg-danger-50/20' : ''}`}
                    >
                      <td className="py-2.5 text-sm" dir="ltr">{new Date(inv.uploadedAt).toLocaleDateString('he-IL')}</td>
                      <td className="py-2.5 text-sm font-medium">{inv.supplierName || '—'}</td>
                      <td className="py-2.5 text-sm text-gray-500" dir="ltr">{inv.invoiceNumber || '—'}</td>
                      <td className="py-2.5 text-sm" dir="ltr">{formatAgorot(inv.totalInvoiceAmount)}</td>
                      <td className="py-2.5 text-sm">
                        {inv.totalOverchargeAmount > 0 ? (
                          <span className="text-danger-500 font-medium" dir="ltr">{formatAgorot(inv.totalOverchargeAmount)}</span>
                        ) : (
                          <span className="text-success-500 text-xs">תקין</span>
                        )}
                      </td>
                      <td className="py-2.5 text-sm">
                        {inv.overchargeCount > 0 ? (
                          <span className="badge-overcharge">{inv.overchargeCount}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-cards space-y-2">
              {recentInvoices.map((inv) => (
                <div
                  key={inv._id}
                  onClick={() => navigate(`/app/invoices/${inv._id}`)}
                  className={`flex justify-between items-center py-3 px-1 border-b border-gray-100 cursor-pointer active:bg-gray-50`}
                >
                  <div>
                    <p className="font-medium text-sm">{inv.supplierName || '—'}</p>
                    <p className="text-xs text-gray-400" dir="ltr">{new Date(inv.uploadedAt).toLocaleDateString('he-IL')}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium" dir="ltr">{formatAgorot(inv.totalInvoiceAmount)}</p>
                    {inv.totalOverchargeAmount > 0 ? (
                      <p className="text-xs text-danger-500 font-medium" dir="ltr">{formatAgorot(inv.totalOverchargeAmount)}</p>
                    ) : (
                      <p className="text-xs text-success-500">תקין</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
