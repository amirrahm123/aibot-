import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { IInvoice, MatchStatus } from '@shared/types';
import * as invoicesApi from '../api/invoices';

function formatAgorot(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2)}`;
}

function unitLabel(unit: string): string {
  const map: Record<string, string> = { kg: 'ק"ג', unit: 'יח׳', liter: 'ליטר', box: 'קרטון', other: '' };
  return map[unit] || unit;
}

function statusBadge(status: MatchStatus) {
  switch (status) {
    case 'ok': return <span className="badge-ok">תקין</span>;
    case 'overcharge': return <span className="badge-overcharge">חריגה</span>;
    case 'no_agreement': return <span className="badge-no-agreement">ללא הסכם</span>;
    case 'needs_review': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">לבדיקה</span>;
    default: return null;
  }
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<IInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);

  const loadInvoice = async () => {
    try {
      const data = await invoicesApi.getInvoice(id!);
      setInvoice(data);
    } catch {
      toast.error('שגיאה בטעינת חשבונית');
      navigate('/app/invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvoice(); }, [id]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const data = await invoicesApi.reprocessInvoice(id!);
      setInvoice(data);
      toast.success('החשבונית עובדה מחדש');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה');
    } finally {
      setReprocessing(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const blob = await invoicesApi.getInvoiceReport(id!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overcharge-report-${invoice?.invoiceNumber || id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('שגיאה בהורדת דו"ח');
    }
  };

  const handleExportCsv = () => {
    if (!invoice) return;
    const overcharged = invoice.lineItems.filter((item) => item.isOvercharge);
    const rows = overcharged.map((item) => ({
      product: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      agreed_price: ((item.agreedPrice || 0) / 100).toFixed(2),
      invoiced_price: (item.unitPrice / 100).toFixed(2),
      overcharge_per_unit: ((item.priceDiff || 0) / 100).toFixed(2),
      total_overcharge: ((item.overchargeAmount || 0) / 100).toFixed(2),
    }));
    const header = 'מוצר,כמות,יחידה,מחיר מוסכם,מחיר בחשבונית,חריגה ליחידה,סה"כ חריגה';
    const csv = [header, ...rows.map((r) => `${r.product},${r.quantity},${r.unit},${r.agreed_price},${r.invoiced_price},${r.overcharge_per_unit},${r.total_overcharge}`)].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overcharges-${invoice.invoiceNumber || id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateWhatsAppMessage = (): string => {
    if (!invoice) return '';
    const overcharged = invoice.lineItems.filter((item) => item.isOvercharge);
    let msg = `שלום,\nבחשבונית מספר ${invoice.invoiceNumber || '—'} מתאריך ${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('he-IL') : '—'} זיהינו חריגות מחיר:\n`;
    overcharged.forEach((item) => {
      msg += `- ${item.productName}: מחיר מוסכם ${formatAgorot(item.agreedPrice || 0)}/${unitLabel(item.unit)}, חויבנו ${formatAgorot(item.unitPrice)}/${unitLabel(item.unit)} (חריגה של ${formatAgorot(item.priceDiff || 0)}/${unitLabel(item.unit)} × ${item.quantity} ${unitLabel(item.unit)} = ${formatAgorot(item.overchargeAmount || 0)})\n`;
    });
    msg += `\nסה"כ חריגה: ${formatAgorot(invoice.totalOverchargeAmount)}\nאנא בדוק ותקן.`;
    return msg;
  };

  const handleWhatsApp = () => {
    const phone = (invoice as any)?.supplierPhone?.replace(/\D/g, '') || '';
    const msg = encodeURIComponent(generateWhatsAppMessage());
    const url = phone
      ? `https://wa.me/972${phone.startsWith('0') ? phone.slice(1) : phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  };

  const handleDelete = async () => {
    if (!confirm('בטוח שברצונך למחוק חשבונית זו?')) return;
    try {
      await invoicesApi.deleteInvoice(id!);
      toast.success('חשבונית נמחקה');
      navigate('/app/invoices');
    } catch {
      toast.error('שגיאה במחיקה');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        <p className="text-gray-500">טוען חשבונית...</p>
      </div>
    );
  }

  if (!invoice) return null;

  const hasOvercharges = invoice.overchargeCount > 0;

  return (
    <div>
      {/* Back button */}
      <button onClick={() => navigate('/app/invoices')} className="text-sm text-primary-500 hover:underline mb-4">
        → חזרה לחשבוניות
      </button>

      {/* Overcharge alert banner */}
      {hasOvercharges && (
        <div className="bg-danger-500 text-white rounded-xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="font-bold text-base md:text-lg">
              נמצאו {invoice.overchargeCount} חריגות מחיר — סה״כ {formatAgorot(invoice.totalOverchargeAmount)} יותר ממה שסוכם
            </p>
          </div>
          <button onClick={handleWhatsApp} className="bg-white text-danger-500 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors text-sm w-full md:w-auto min-h-[44px]">
            שלח הודעה לספק
          </button>
        </div>
      )}

      {/* Invoice header */}
      <div className="card mb-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-xl font-bold mb-2">{invoice.supplierName || 'ספק לא ידוע'}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {invoice.invoiceNumber && <span>חשבונית מס׳ {invoice.invoiceNumber}</span>}
              {invoice.invoiceDate && <span>{new Date(invoice.invoiceDate).toLocaleDateString('he-IL')}</span>}
              <span>סה״כ: <strong dir="ltr">{formatAgorot(invoice.totalInvoiceAmount)}</strong></span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
            <button onClick={handleExportReport} className="btn-secondary text-sm">ייצוא דו״ח</button>
            {hasOvercharges && <button onClick={handleExportCsv} className="btn-secondary text-sm">ייצוא CSV</button>}
            <button onClick={handleReprocess} disabled={reprocessing} className="btn-secondary text-sm">
              {reprocessing ? 'מעבד...' : 'עבד מחדש'}
            </button>
            <button onClick={handleDelete} className="btn-danger text-sm">מחק</button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {invoice.status === 'error' && (
        <div className="bg-danger-50 border border-danger-200 text-danger-500 rounded-xl p-4 mb-6">
          <p className="font-medium">שגיאה בעיבוד החשבונית</p>
          <p className="text-sm mt-1">לחץ על "עבד מחדש" לנסות שוב</p>
        </div>
      )}

      {/* Line items — desktop table */}
      {invoice.lineItems.length > 0 && (
        <div className="desktop-table overflow-x-auto">
          <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-gray-500">
                <th className="text-right px-4 py-3">מוצר</th>
                <th className="text-right px-4 py-3">כמות</th>
                <th className="text-right px-4 py-3">מחיר מוסכם</th>
                <th className="text-right px-4 py-3">מחיר בחשבונית</th>
                <th className="text-right px-4 py-3">הפרש ליחידה</th>
                <th className="text-right px-4 py-3">סה״כ חריגה</th>
                <th className="text-right px-4 py-3">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-100 ${
                    item.isOvercharge ? 'bg-danger-50/40' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium">{item.productName}</td>
                  <td className="px-4 py-3 text-sm">{item.quantity} {unitLabel(item.unit)}</td>
                  <td className="px-4 py-3 text-sm text-success-500 font-medium" dir="ltr">
                    {item.agreedPrice != null ? `${formatAgorot(item.agreedPrice)}/${unitLabel(item.unit)}` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${item.isOvercharge ? 'text-danger-500' : ''}`} dir="ltr">
                    {formatAgorot(item.unitPrice)}/{unitLabel(item.unit)}
                  </td>
                  <td className={`px-4 py-3 text-sm ${(item.priceDiff || 0) > 0 ? 'text-danger-500 font-medium' : ''}`} dir="ltr">
                    {item.priceDiff != null ? formatAgorot(item.priceDiff) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-danger-500" dir="ltr">
                    {item.isOvercharge ? formatAgorot(item.overchargeAmount || 0) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">{statusBadge(item.matchStatus)}</td>
                </tr>
              ))}
            </tbody>
            {hasOvercharges && (
              <tfoot>
                <tr className="bg-danger-50 font-bold">
                  <td colSpan={5} className="px-4 py-3 text-sm text-danger-500">סה״כ חריגות</td>
                  <td className="px-4 py-3 text-sm text-danger-500" dir="ltr">{formatAgorot(invoice.totalOverchargeAmount)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Line items — mobile cards */}
      {invoice.lineItems.length > 0 && (
        <div className="mobile-cards space-y-3">
          {invoice.lineItems.map((item, idx) => (
            <div
              key={idx}
              className={`card !p-4 ${item.isOvercharge ? 'border-danger-200 bg-danger-50/30' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-base">{item.productName}</h3>
                {statusBadge(item.matchStatus)}
              </div>
              <p className="text-sm text-gray-600 mb-2">כמות: {item.quantity} {unitLabel(item.unit)}</p>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">מוסכם:</span>
                <span className="text-success-500 font-medium" dir="ltr">
                  {item.agreedPrice != null ? `${formatAgorot(item.agreedPrice)}/${unitLabel(item.unit)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">בפועל:</span>
                <span className={`font-medium ${item.isOvercharge ? 'text-danger-500' : ''}`} dir="ltr">
                  {formatAgorot(item.unitPrice)}/{unitLabel(item.unit)}
                </span>
              </div>
              {(item.priceDiff || 0) > 0 && (
                <>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">הפרש ליחידה:</span>
                    <span className="text-danger-500 font-medium" dir="ltr">{formatAgorot(item.priceDiff || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                    <span className="text-danger-500">סה״כ חריגה:</span>
                    <span className="text-danger-500" dir="ltr">{formatAgorot(item.overchargeAmount || 0)}</span>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Mobile total overcharge summary */}
          {hasOvercharges && (
            <div className="card !p-4 bg-danger-50 border-danger-200">
              <div className="flex justify-between items-center font-bold text-danger-500">
                <span>סה״כ חריגות</span>
                <span dir="ltr">{formatAgorot(invoice.totalOverchargeAmount)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No agreements prompt */}
      {invoice.lineItems.length > 0 && invoice.lineItems.every((item) => item.matchStatus === 'no_agreement') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-4">
          <p className="text-yellow-700 font-medium">לא נמצאו הסכמי מחיר לספק זה</p>
          <p className="text-sm text-yellow-600 mt-1">
            הוסף הסכמי מחיר כדי לזהות חריגות אוטומטית
          </p>
          <button
            onClick={() => navigate(`/agreements?supplierId=${invoice.supplierId}`)}
            className="text-sm text-primary-500 hover:underline mt-2"
          >
            הוסף הסכמי מחיר →
          </button>
        </div>
      )}
    </div>
  );
}
