import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { IInvoice, ISupplier, PaginatedResponse } from '@shared/types';
import * as invoicesApi from '../api/invoices';
import * as suppliersApi from '../api/suppliers';
import { useOnboardingStore } from '../store/onboardingStore';
import OnboardingTooltip from '../components/OnboardingTooltip';

function formatAgorot(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2)}`;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<PaginatedResponse<IInvoice> | null>(null);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadSupplierId, setUploadSupplierId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [overchargeOnly, setOverchargeOnly] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { markStep, steps } = useOnboardingStore();
  const uploadBtnRef = useRef<HTMLButtonElement>(null);

  const loadData = async () => {
    try {
      const [invs, sups] = await Promise.all([
        invoicesApi.getInvoices({ page, supplierId: filterSupplier || undefined, overchargeOnly, search: search || undefined }),
        suppliersApi.getSuppliers(),
      ]);
      setInvoices(invs);
      setSuppliers(sups);
      if (invs.data.length > 0 && !steps.uploadedInvoice) {
        markStep('uploadedInvoice');
      }
      if (sups.length > 0 && !steps.addedSupplier) {
        markStep('addedSupplier');
      }
    } catch {
      toast.error('שגיאה בטעינת חשבוניות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, filterSupplier, overchargeOnly]);

  const handleSearch = () => { setPage(1); loadData(); };

  const onDrop = useCallback((files: File[]) => {
    if (files.length > 0) setUploadFile(files[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!uploadFile || !uploadSupplierId) {
      toast.error('נא לבחור ספק וקובץ');
      return;
    }
    setUploading(true);
    try {
      const invoice = await invoicesApi.uploadInvoice(uploadFile, uploadSupplierId);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadSupplierId('');

      markStep('uploadedInvoice');

      if (invoice.overchargeCount > 0) {
        toast.error(`נמצאו ${invoice.overchargeCount} חריגות מחיר! לחץ לפרטים`, { duration: 6000 });
      } else {
        toast.success('חשבונית עובדה בהצלחה');
      }

      navigate(`/invoices/${invoice._id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בעיבוד החשבונית');
    } finally {
      setUploading(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'done': return <span className="badge-ok">הושלם</span>;
      case 'processing': return <span className="badge-processing">מעבד...</span>;
      case 'error': return <span className="badge-overcharge">שגיאה</span>;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 skeleton w-28" />
          <div className="h-10 skeleton w-36" />
        </div>
        <div className="flex gap-3 mb-4">
          <div className="h-10 skeleton w-40" />
          <div className="h-10 skeleton w-40" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">חשבוניות</h1>
        <div className="relative">
          <button ref={uploadBtnRef} onClick={() => setShowUploadModal(true)} className="btn-primary">
            העלה חשבונית
          </button>
          {(!invoices || invoices.data.length === 0) && (
            <OnboardingTooltip
              id="invoices-upload-btn"
              targetRef={uploadBtnRef}
              text="גרור PDF של חשבונית לכאן כדי לזהות חריגות מחיר אוטומטית"
            />
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="חיפוש..."
          className="input-field md:max-w-xs"
        />
        <select value={filterSupplier} onChange={(e) => { setFilterSupplier(e.target.value); setPage(1); }} className="input-field md:max-w-xs">
          <option value="">כל הספקים</option>
          {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm min-h-[44px]">
          <input type="checkbox" checked={overchargeOnly} onChange={(e) => { setOverchargeOnly(e.target.checked); setPage(1); }} className="rounded w-5 h-5" />
          חריגות בלבד
        </label>
      </div>

      {/* Upload modal — full-screen on mobile */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center z-50 md:px-4">
          <div className="bg-white h-full md:h-auto md:rounded-xl md:shadow-sm md:border md:border-gray-100 md:max-w-lg w-full p-6 flex flex-col">
            <h2 className="text-lg font-semibold mb-4">העלאת חשבונית</h2>
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ספק *</label>
                <select value={uploadSupplierId} onChange={(e) => setUploadSupplierId(e.target.value)} className="input-field">
                  <option value="">בחר ספק</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-6 md:p-8 text-center cursor-pointer transition-colors min-h-[120px] flex items-center justify-center ${
                  isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
                }`}
              >
                <input {...getInputProps()} />
                {uploadFile ? (
                  <div>
                    <p className="font-medium text-base">{uploadFile.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }} className="text-sm text-danger-500 mt-2 min-h-[44px]">הסר</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-500 text-base">גרור קובץ לכאן או לחץ לבחירה</p>
                    <p className="text-sm text-gray-400 mt-1">PDF, JPEG, PNG — עד 20MB</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-2 mt-auto pt-4">
                <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadSupplierId} className="btn-primary flex-1 order-1">
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      מעבד חשבונית עם AI...
                    </span>
                  ) : (
                    'העלה ועבד'
                  )}
                </button>
                <button onClick={() => { setShowUploadModal(false); setUploadFile(null); }} className="btn-secondary order-2" disabled={uploading}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {!invoices || invoices.data.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📄</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">עדיין אין חשבוניות</h2>
          <p className="text-gray-500 mb-6">העלה חשבונית ראשונה מאחד הספקים שלך</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn-primary text-base px-8 py-3"
          >
            + העלה חשבונית
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="desktop-table overflow-x-auto">
            <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="text-right px-4 py-3">תאריך</th>
                  <th className="text-right px-4 py-3">ספק</th>
                  <th className="text-right px-4 py-3">מס׳ חשבונית</th>
                  <th className="text-right px-4 py-3">סה״כ</th>
                  <th className="text-right px-4 py-3">חריגה</th>
                  <th className="text-right px-4 py-3">פריטים חורגים</th>
                  <th className="text-right px-4 py-3">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((inv) => (
                  <tr
                    key={inv._id}
                    onClick={() => navigate(`/invoices/${inv._id}`)}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${inv.overchargeCount > 0 ? 'bg-danger-50/30' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm" dir="ltr">{new Date(inv.uploadedAt).toLocaleDateString('he-IL')}</td>
                    <td className="px-4 py-3 text-sm font-medium">{inv.supplierName || '—'}</td>
                    <td className="px-4 py-3 text-sm" dir="ltr">{inv.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3 text-sm" dir="ltr">{formatAgorot(inv.totalInvoiceAmount)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-danger-500" dir="ltr">
                      {inv.totalOverchargeAmount > 0 ? formatAgorot(inv.totalOverchargeAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {inv.overchargeCount > 0 ? (
                        <span className="badge-overcharge">{inv.overchargeCount}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{statusBadge(inv.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mobile-cards space-y-3">
            {invoices.data.map((inv) => (
              <div
                key={inv._id}
                onClick={() => navigate(`/invoices/${inv._id}`)}
                className={`card !p-4 cursor-pointer active:bg-gray-50 ${inv.overchargeCount > 0 ? 'border-danger-200 bg-danger-50/20' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-base">{inv.supplierName || '—'}</h3>
                    <p className="text-sm text-gray-500" dir="ltr">{inv.invoiceNumber || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(inv.status)}
                  </div>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-500">{new Date(inv.uploadedAt).toLocaleDateString('he-IL')}</span>
                  <span className="font-medium" dir="ltr">{formatAgorot(inv.totalInvoiceAmount)}</span>
                </div>
                {inv.overchargeCount > 0 && (
                  <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-gray-100">
                    <span className="text-danger-500 font-medium">
                      {inv.overchargeCount} חריגות
                    </span>
                    <span className="text-danger-500 font-bold" dir="ltr">{formatAgorot(inv.totalOverchargeAmount)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {invoices.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm">
                הקודם
              </button>
              <span className="py-2 px-3 text-sm text-gray-600">
                עמוד {page} מתוך {invoices.totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(invoices!.totalPages, p + 1))} disabled={page >= invoices.totalPages} className="btn-secondary text-sm">
                הבא
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
