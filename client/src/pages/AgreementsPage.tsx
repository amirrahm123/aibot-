import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { IPriceAgreement, ISupplier, UnitType } from '@shared/types';
import * as agreementsApi from '../api/agreements';
import * as suppliersApi from '../api/suppliers';
import { useOnboardingStore } from '../store/onboardingStore';

const UNITS: { value: UnitType; label: string }[] = [
  { value: 'kg', label: 'ק"ג' },
  { value: 'unit', label: 'יחידה' },
  { value: 'liter', label: 'ליטר' },
  { value: 'box', label: 'קרטון' },
  { value: 'other', label: 'אחר' },
];

export default function AgreementsPage() {
  const [searchParams] = useSearchParams();
  const filterSupplier = searchParams.get('supplierId') || '';

  const [agreements, setAgreements] = useState<IPriceAgreement[]>([]);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState(filterSupplier);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const { markStep, steps } = useOnboardingStore();

  const [form, setForm] = useState({
    supplierId: filterSupplier,
    productName: '',
    unit: 'kg' as UnitType,
    agreedPrice: '',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      const [agrs, sups] = await Promise.all([
        agreementsApi.getAgreements(selectedSupplier || undefined),
        suppliersApi.getSuppliers(),
      ]);
      setAgreements(agrs);
      setSuppliers(sups);
      if (agrs.length > 0 && !steps.addedAgreement) {
        markStep('addedAgreement');
      }
    } catch {
      toast.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedSupplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        agreedPrice: parseFloat(form.agreedPrice),
        validUntil: form.validUntil || null,
      };
      if (editingId) {
        await agreementsApi.updateAgreement(editingId, data);
        toast.success('הסכם עודכן');
      } else {
        await agreementsApi.createAgreement(data);
        toast.success('הסכם נוסף');
        markStep('addedAgreement');
      }
      setShowForm(false);
      setEditingId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('למחוק הסכם מחיר זה?')) return;
    try {
      await agreementsApi.deleteAgreement(id);
      toast.success('הסכם נמחק');
      loadData();
    } catch {
      toast.error('שגיאה');
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const items = results.data as any[];
        try {
          const res = await agreementsApi.bulkImportAgreements(
            items.map((row) => ({
              supplierName: row.supplier_name || row.supplierName,
              productName: row.product_name || row.productName,
              unit: row.unit || 'kg',
              agreedPrice: parseFloat(row.agreed_price || row.agreedPrice || '0'),
              notes: row.notes,
            }))
          );
          toast.success(`יובאו ${res.created} הסכמים`);
          if (res.errors.length > 0) {
            toast.error(`${res.errors.length} שגיאות: ${res.errors[0]}`);
          }
          loadData();
        } catch {
          toast.error('שגיאה בייבוא');
        }
      },
    });
    e.target.value = '';
  };

  const downloadCsvTemplate = () => {
    const csv = 'supplier_name,product_name,unit,agreed_price,notes\nירקות כהן בע"מ,עגבניות,kg,4.50,\n';
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price_agreements_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSupplierName = (id: string) => {
    const s = suppliers.find((s) => s._id === id);
    return s?.name || '';
  };

  const isExpired = (a: IPriceAgreement) => {
    return a.validUntil ? new Date(a.validUntil) < new Date() : false;
  };

  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 skeleton w-32" />
          <div className="flex gap-2"><div className="h-10 skeleton w-28" /><div className="h-10 skeleton w-28" /></div>
        </div>
        <div className="h-10 skeleton w-48 mb-4" />
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
        <h1 className="text-2xl font-bold">הסכמי מחיר</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCsvTemplate} className="btn-secondary text-sm">הורד תבנית CSV</button>
          <button onClick={() => csvInputRef.current?.click()} className="btn-secondary text-sm">ייבוא CSV</button>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm({ supplierId: selectedSupplier, productName: '', unit: 'kg', agreedPrice: '', validFrom: new Date().toISOString().split('T')[0], validUntil: '', notes: '' });
            }}
            className="btn-primary text-sm"
          >
            + הסכם חדש
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={selectedSupplier}
          onChange={(e) => setSelectedSupplier(e.target.value)}
          className="input-field md:max-w-xs"
        >
          <option value="">כל הספקים</option>
          {suppliers.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Form modal — full-screen on mobile */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center z-50 md:px-4">
          <div className="bg-white h-full md:h-auto md:rounded-xl md:shadow-sm md:border md:border-gray-100 md:max-w-md w-full p-6 overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editingId ? 'עריכת הסכם' : 'הסכם מחיר חדש'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ספק *</label>
                <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="input-field" required>
                  <option value="">בחר ספק</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מוצר *</label>
                <input type="text" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} className="input-field" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">יחידה *</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as UnitType })} className="input-field">
                    {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מחיר מוסכם (₪) *</label>
                  <input type="number" step="0.01" value={form.agreedPrice} onChange={(e) => setForm({ ...form, agreedPrice: e.target.value })} className="input-field" dir="ltr" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תוקף מ- *</label>
                  <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className="input-field" dir="ltr" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תוקף עד</label>
                  <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="input-field" dir="ltr" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{editingId ? 'עדכן' : 'הוסף'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agreements list */}
      {agreements.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">💰</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            {selectedSupplier ? 'אין הסכמי מחיר לספק זה' : 'עדיין אין הסכמי מחיר'}
          </h2>
          <p className="text-gray-500 mb-6">הגדר מחירים מוסכמים כדי לזהות חריגות אוטומטית</p>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm({ supplierId: selectedSupplier, productName: '', unit: 'kg', agreedPrice: '', validFrom: new Date().toISOString().split('T')[0], validUntil: '', notes: '' });
            }}
            className="btn-primary text-base px-8 py-3"
          >
            + הוסף הסכם ראשון
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="desktop-table overflow-x-auto">
            <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="text-right px-4 py-3">ספק</th>
                  <th className="text-right px-4 py-3">מוצר</th>
                  <th className="text-right px-4 py-3">יחידה</th>
                  <th className="text-right px-4 py-3">מחיר מוסכם</th>
                  <th className="text-right px-4 py-3">תוקף מ-</th>
                  <th className="text-right px-4 py-3">תוקף עד</th>
                  <th className="text-right px-4 py-3">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((a) => (
                  <tr key={a._id} className={`border-b border-gray-100 hover:bg-gray-50 ${isExpired(a) ? 'opacity-50 bg-gray-50' : ''}`}>
                    <td className="px-4 py-3 text-sm">{(a as any).supplierId?.name || getSupplierName(a.supplierId)}</td>
                    <td className="px-4 py-3 text-sm font-medium">{a.productName}</td>
                    <td className="px-4 py-3 text-sm">{UNITS.find((u) => u.value === a.unit)?.label || a.unit}</td>
                    <td className="px-4 py-3 text-sm font-medium text-success-500" dir="ltr">₪{(a.agreedPrice / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm" dir="ltr">{new Date(a.validFrom).toLocaleDateString('he-IL')}</td>
                    <td className="px-4 py-3 text-sm" dir="ltr">{a.validUntil ? new Date(a.validUntil).toLocaleDateString('he-IL') : <span className="text-gray-400" dir="rtl">ללא תפוגה</span>}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(a._id);
                            setForm({
                              supplierId: a.supplierId,
                              productName: a.productName,
                              unit: a.unit,
                              agreedPrice: (a.agreedPrice / 100).toString(),
                              validFrom: new Date(a.validFrom).toISOString().split('T')[0],
                              validUntil: a.validUntil ? new Date(a.validUntil).toISOString().split('T')[0] : '',
                              notes: a.notes || '',
                            });
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-primary-500 hover:bg-primary-50 transition-colors"
                          title="ערוך"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(a._id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-danger-500 hover:bg-danger-50 transition-colors"
                          title="מחק"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mobile-cards space-y-3">
            {agreements.map((a) => (
              <div key={a._id} className={`card card-hover !p-4 ${isExpired(a) ? 'opacity-50 border-gray-300' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-base">{a.productName}</h3>
                    <p className="text-sm text-gray-500">{(a as any).supplierId?.name || getSupplierName(a.supplierId)}</p>
                  </div>
                  <span className="text-success-500 font-bold text-base" dir="ltr">₪{(a.agreedPrice / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 mb-3">
                  <span>יחידה: {UNITS.find((u) => u.value === a.unit)?.label || a.unit}</span>
                  <span dir="ltr">{new Date(a.validFrom).toLocaleDateString('he-IL')}{a.validUntil ? ` — ${new Date(a.validUntil).toLocaleDateString('he-IL')}` : <span className="text-gray-400 mr-1" dir="rtl"> · ללא תפוגה</span>}</span>
                </div>
                <div className="flex gap-2 border-t border-gray-100 pt-2">
                  <button
                    onClick={() => {
                      setEditingId(a._id);
                      setForm({
                        supplierId: a.supplierId,
                        productName: a.productName,
                        unit: a.unit,
                        agreedPrice: (a.agreedPrice / 100).toString(),
                        validFrom: new Date(a.validFrom).toISOString().split('T')[0],
                        validUntil: a.validUntil ? new Date(a.validUntil).toISOString().split('T')[0] : '',
                        notes: a.notes || '',
                      });
                      setShowForm(true);
                    }}
                    className="p-2 rounded-lg text-gray-500 hover:text-primary-500 hover:bg-primary-50 transition-colors min-h-[44px] flex items-center"
                    title="ערוך"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button
                    onClick={() => handleDelete(a._id)}
                    className="p-2 rounded-lg text-gray-500 hover:text-danger-500 hover:bg-danger-50 transition-colors min-h-[44px] flex items-center"
                    title="מחק"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
