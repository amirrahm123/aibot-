import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ISupplier, SupplierCategory, SUPPLIER_CATEGORIES } from '@shared/types';
import * as suppliersApi from '../api/suppliers';

const defaultForm = {
  name: '',
  contactName: '',
  contactPhone: '',
  email: '',
  category: 'אחר' as SupplierCategory,
  notes: '',
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const navigate = useNavigate();

  const loadSuppliers = async () => {
    try {
      const data = await suppliersApi.getSuppliers(showAll);
      setSuppliers(data);
    } catch {
      toast.error('שגיאה בטעינת ספקים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSuppliers(); }, [showAll]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await suppliersApi.updateSupplier(editingId, form);
        toast.success('ספק עודכן בהצלחה');
      } else {
        await suppliersApi.createSupplier(form);
        toast.success('ספק נוסף בהצלחה');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(defaultForm);
      loadSuppliers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה');
    }
  };

  const handleEdit = (s: ISupplier) => {
    setForm({
      name: s.name,
      contactName: s.contactName || '',
      contactPhone: s.contactPhone || '',
      email: s.email || '',
      category: s.category,
      notes: s.notes || '',
    });
    setEditingId(s._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('להעביר ספק זה ללא פעיל?')) return;
    try {
      await suppliersApi.deleteSupplier(id);
      toast.success('ספק הועבר ללא פעיל');
      loadSuppliers();
    } catch {
      toast.error('שגיאה');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await suppliersApi.updateSupplier(id, { isActive: true });
      toast.success('ספק הופעל מחדש');
      loadSuppliers();
    } catch {
      toast.error('שגיאה');
    }
  };

  const categoryBadgeColor = (cat: string): string => {
    const colors: Record<string, string> = {
      'ירקות ופירות': 'bg-green-100 text-green-700',
      'מזון': 'bg-orange-100 text-orange-700',
      'מזון ושתייה': 'bg-amber-100 text-amber-700',
      'ניקוי': 'bg-cyan-100 text-cyan-700',
      'ציוד משרדי': 'bg-blue-100 text-blue-700',
      'ציוד מחשבים': 'bg-purple-100 text-purple-700',
      'ריהוט': 'bg-rose-100 text-rose-700',
      'לוגיסטיקה': 'bg-yellow-100 text-yellow-700',
    };
    return colors[cat] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div></div>;
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">ספקים</h1>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600 min-h-[44px]">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded w-5 h-5"
            />
            הצג לא פעילים
          </label>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm); }}
            className="btn-primary hidden md:block"
          >
            + הוסף ספק
          </button>
        </div>
      </div>

      {/* Form modal — full-screen on mobile */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center z-50 md:px-4">
          <div className="bg-white h-full md:h-auto md:rounded-xl md:shadow-sm md:border md:border-gray-100 md:max-w-lg w-full md:max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-4">{editingId ? 'עריכת ספק' : 'ספק חדש'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם ספק *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as SupplierCategory })}
                  className="input-field"
                >
                  {SUPPLIER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">איש קשר</label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="input-field"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-field"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input-field"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">{editingId ? 'עדכן' : 'הוסף'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier cards */}
      {suppliers.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <p className="text-lg">אין ספקים עדיין</p>
          <p className="text-sm mt-1">הוסף ספק ראשון כדי להתחיל</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div
              key={s._id}
              className={`card hover:shadow-md transition-shadow ${!s.isActive ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{s.name}</h3>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${categoryBadgeColor(s.category)}`}>
                    {s.category}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(s)} className="text-sm text-primary-500 hover:underline">ערוך</button>
                  {s.isActive ? (
                    <button onClick={() => handleDelete(s._id)} className="text-sm text-danger-500 hover:underline">השבת</button>
                  ) : (
                    <button onClick={() => handleReactivate(s._id)} className="text-sm text-success-500 hover:underline">הפעל</button>
                  )}
                </div>
              </div>

              {s.contactName && (
                <p className="text-sm text-gray-600">
                  <span className="text-gray-400">איש קשר:</span> {s.contactName}
                </p>
              )}
              {s.contactPhone && <p className="text-sm text-gray-500" dir="ltr">{s.contactPhone}</p>}
              {s.email && <p className="text-sm text-gray-500" dir="ltr">{s.email}</p>}

              <div className="flex gap-4 text-sm text-gray-600 mt-3 border-t pt-3">
                <span>{s.agreementCount || 0} הסכמים</span>
                <span>{s.invoiceCount || 0} חשבוניות</span>
              </div>

              {(s.overchargeRiskPercent || 0) > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-danger-500 font-medium">
                    סיכון חריגה: {s.overchargeRiskPercent}%
                  </span>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-danger-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(s.overchargeRiskPercent || 0, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {!s.isActive && (
                <span className="inline-block mt-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">לא פעיל</span>
              )}

              <button
                onClick={() => navigate(`/agreements?supplierId=${s._id}`)}
                className="text-sm text-primary-500 hover:underline mt-3 block min-h-[44px] flex items-center"
              >
                צפה בהסכמי מחיר →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mobile sticky add button */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-30">
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm); }}
          className="btn-primary w-full text-base"
        >
          + הוסף ספק
        </button>
      </div>
      {/* Spacer for sticky button */}
      <div className="md:hidden h-20" />
    </div>
  );
}
