import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ISupplier, SupplierCategory, SUPPLIER_CATEGORIES } from '@shared/types';
import * as suppliersApi from '../api/suppliers';
import { useOnboardingStore } from '../store/onboardingStore';
import OnboardingTooltip from '../components/OnboardingTooltip';

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
  const { markStep, steps } = useOnboardingStore();
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const loadSuppliers = async () => {
    try {
      const data = await suppliersApi.getSuppliers(showAll);
      setSuppliers(data);
      if (data.length > 0 && !steps.addedSupplier) {
        markStep('addedSupplier');
      }
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
        markStep('addedSupplier');
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

  // Generate avatar color from name
  const avatarColor = (name: string): string => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
      'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return words[0][0] + words[1][0];
    return name.slice(0, 2);
  };

  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 skeleton w-24" />
          <div className="h-10 skeleton w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card">
              <div className="flex gap-3 mb-3">
                <div className="w-10 h-10 skeleton rounded-full" />
                <div className="flex-1"><div className="h-5 skeleton w-32 mb-2" /><div className="h-4 skeleton w-20" /></div>
              </div>
              <div className="h-4 skeleton w-full mb-2" />
              <div className="h-4 skeleton w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
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
          <div className="relative hidden md:block">
            <button
              ref={addBtnRef}
              onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm); }}
              className="btn-primary"
              id="add-supplier-btn"
            >
              + הוסף ספק
            </button>
            {suppliers.length === 0 && (
              <OnboardingTooltip
                id="suppliers-add-btn"
                targetRef={addBtnRef}
                text="לחץ כאן להוסיף את הספק הראשון שלך"
              />
            )}
          </div>
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
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">עדיין אין ספקים</h2>
          <p className="text-gray-500 mb-6">הוסף את הספק הראשון שלך כדי להתחיל לעקוב אחר מחירים</p>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm); }}
            className="btn-primary text-base px-8 py-3"
          >
            + הוסף ספק ראשון
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div
              key={s._id}
              className={`card card-hover ${!s.isActive ? 'opacity-50' : ''}`}
            >
              {/* Header: avatar + name + category */}
              <div className="flex gap-3 mb-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${avatarColor(s.name)} text-white flex items-center justify-center font-bold text-sm`}>
                  {getInitials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-base truncate">{s.name}</h3>
                    {/* Agreement status */}
                    {(s.agreementCount || 0) > 0 ? (
                      <span className="flex-shrink-0 text-success-500 text-sm" title="יש הסכמי מחיר">✓</span>
                    ) : (
                      <span className="flex-shrink-0 text-amber-500 text-sm" title="אין הסכמי מחיר">⚠</span>
                    )}
                  </div>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${categoryBadgeColor(s.category)}`}>
                    {s.category}
                  </span>
                </div>
              </div>

              {/* Contact info */}
              {s.contactName && (
                <p className="text-sm text-gray-600">
                  <span className="text-gray-400">איש קשר:</span> {s.contactName}
                </p>
              )}
              {s.contactPhone && <p className="text-sm text-gray-500" dir="ltr">{s.contactPhone}</p>}

              {/* Stats */}
              <div className="flex gap-4 text-sm text-gray-600 mt-3 border-t pt-3">
                <span>{s.agreementCount || 0} הסכמים</span>
                <span>{s.invoiceCount || 0} חשבוניות</span>
              </div>

              {/* Overcharge risk */}
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

              {/* Actions */}
              <div className="flex justify-between items-center mt-3 pt-3 border-t">
                <button
                  onClick={() => navigate(`/agreements?supplierId=${s._id}`)}
                  className="text-sm text-primary-500 hover:underline"
                >
                  הסכמי מחיר →
                </button>
                <div className="flex gap-3">
                  <button onClick={() => handleEdit(s)} className="text-sm text-primary-500 hover:underline">ערוך</button>
                  {s.isActive ? (
                    <button onClick={() => handleDelete(s._id)} className="text-sm text-danger-500 hover:underline">השבת</button>
                  ) : (
                    <button onClick={() => handleReactivate(s._id)} className="text-sm text-success-500 hover:underline">הפעל</button>
                  )}
                </div>
              </div>
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
