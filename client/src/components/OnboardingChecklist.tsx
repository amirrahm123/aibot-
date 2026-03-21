import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../store/onboardingStore';

export default function OnboardingChecklist() {
  const { showChecklist, completed, steps, finishOnboarding } = useOnboardingStore();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  if (!showChecklist || completed) return null;

  const doneCount = Object.values(steps).filter(Boolean).length;
  const totalSteps = 4;
  const progressPercent = (doneCount / totalSteps) * 100;

  const items = [
    { key: 'registered', label: 'נרשמת למערכת', done: steps.registered, action: null },
    { key: 'addedSupplier', label: 'הוספת ספק ראשון', done: steps.addedSupplier, action: () => navigate('/app/suppliers') },
    { key: 'addedAgreement', label: 'הגדרת מחיר מוסכם לפריט', done: steps.addedAgreement, action: () => navigate('/app/agreements') },
    { key: 'uploadedInvoice', label: 'העלית חשבונית ראשונה', done: steps.uploadedInvoice, action: () => navigate('/app/invoices') },
  ];

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 left-4 z-50 bg-primary-500 text-white rounded-full px-4 py-2 shadow-lg text-sm font-medium hover:bg-primary-600 transition-colors flex items-center gap-2"
      >
        <span>{doneCount}/{totalSteps}</span>
        <span>צעדים ראשונים</span>
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm text-gray-700">צעדים ראשונים</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{doneCount}/{totalSteps}</span>
          <button onClick={() => setCollapsed(true)} className="text-gray-400 hover:text-gray-600 text-xs">
            מזער
          </button>
          {doneCount >= 3 && (
            <button onClick={finishOnboarding} className="text-xs text-primary-500 hover:underline">
              סיים
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div
          className="bg-primary-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={item.action || undefined}
            disabled={!item.action}
            className={`flex items-center gap-3 w-full text-right px-2 py-1.5 rounded-lg transition-colors text-sm ${
              item.action ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
            }`}
          >
            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
              item.done
                ? 'bg-success-500 text-white'
                : 'border-2 border-gray-300'
            }`}>
              {item.done && '✓'}
            </span>
            <span className={item.done ? 'text-gray-400 line-through' : 'text-gray-700'}>
              {item.label}
            </span>
            {!item.done && item.action && (
              <span className="text-primary-500 text-xs mr-auto">→</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
