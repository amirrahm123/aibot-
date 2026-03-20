import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardStats, IInvoice, PaginatedResponse } from '@shared/types';
import * as invoicesApi from '../api/invoices';

function formatAgorot(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2)}`;
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

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-10 bg-gray-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const trendData = stats.overchargeTrend.map((d) => ({
    date: new Date(d.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }),
    amount: d.amount / 100,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">דשבורד</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="card !p-4 md:!p-6">
          <p className="text-xs md:text-sm text-gray-500">חשבוניות החודש</p>
          <p className="text-2xl md:text-3xl font-bold mt-1">{stats.totalInvoices}</p>
        </div>
        <div className="card !p-4 md:!p-6 border-danger-200">
          <p className="text-xs md:text-sm text-gray-500">סה״כ חריגות החודש</p>
          <p className="text-xl md:text-3xl font-bold mt-1 text-danger-500" dir="ltr">{formatAgorot(stats.totalOverchargeAmount)}</p>
        </div>
        <div className="card !p-4 md:!p-6 col-span-2 md:col-span-1">
          <p className="text-xs md:text-sm text-gray-500">פריטים חורגים</p>
          <p className="text-2xl md:text-3xl font-bold mt-1">{stats.overchargeCount}</p>
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
          <button onClick={() => navigate('/invoices')} className="text-sm text-primary-500 hover:underline">
            הצג הכל →
          </button>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-gray-500 text-sm">אין חשבוניות עדיין</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="desktop-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-gray-500">
                    <th className="text-right py-2">תאריך</th>
                    <th className="text-right py-2">ספק</th>
                    <th className="text-right py-2">סה״כ</th>
                    <th className="text-right py-2">חריגה</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr
                      key={inv._id}
                      onClick={() => navigate(`/invoices/${inv._id}`)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-2 text-sm" dir="ltr">{new Date(inv.uploadedAt).toLocaleDateString('he-IL')}</td>
                      <td className="py-2 text-sm">{inv.supplierName || '—'}</td>
                      <td className="py-2 text-sm" dir="ltr">{formatAgorot(inv.totalInvoiceAmount)}</td>
                      <td className="py-2 text-sm">
                        {inv.totalOverchargeAmount > 0 ? (
                          <span className="text-danger-500 font-medium" dir="ltr">{formatAgorot(inv.totalOverchargeAmount)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
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
                  onClick={() => navigate(`/invoices/${inv._id}`)}
                  className={`flex justify-between items-center py-3 px-1 border-b border-gray-100 cursor-pointer active:bg-gray-50 ${inv.totalOverchargeAmount > 0 ? '' : ''}`}
                >
                  <div>
                    <p className="font-medium text-sm">{inv.supplierName || '—'}</p>
                    <p className="text-xs text-gray-400" dir="ltr">{new Date(inv.uploadedAt).toLocaleDateString('he-IL')}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium" dir="ltr">{formatAgorot(inv.totalInvoiceAmount)}</p>
                    {inv.totalOverchargeAmount > 0 && (
                      <p className="text-xs text-danger-500 font-medium" dir="ltr">{formatAgorot(inv.totalOverchargeAmount)}</p>
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
