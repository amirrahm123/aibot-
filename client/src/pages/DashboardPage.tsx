import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardStats, IInvoice } from '@shared/types';
import * as invoicesApi from '../api/invoices';

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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [dashStats, invs] = await Promise.all([
          invoicesApi.getDashboardStats(),
          invoicesApi.getInvoices({ limit: 10 }),
        ]);
        setStats(dashStats);
        setRecentInvoices(invs.data);
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

        {/* Top overcharging suppliers */}
        {stats.topOverchargingSuppliers.length > 0 && (
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
