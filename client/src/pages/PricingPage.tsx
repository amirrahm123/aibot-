import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import * as paymentsApi from '../api/payments';
import { PlanType } from '@shared/types';

interface PlanInfo {
  id: PlanType;
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

const plans: PlanInfo[] = [
  {
    id: 'free',
    name: 'חינם',
    price: '0',
    period: '',
    features: [
      'עד 2 ספקים',
      'עד 10 חשבוניות בחודש',
      'זיהוי חריגות מחיר',
      'דשבורד בסיסי',
    ],
    cta: 'התוכנית הנוכחית',
  },
  {
    id: 'pro',
    name: 'פרו',
    price: '99',
    period: '/חודש',
    popular: true,
    features: [
      'ספקים ללא הגבלה',
      'חשבוניות ללא הגבלה',
      'התראות WhatsApp',
      'דשבורד מתקדם',
      'ייצוא דו"חות',
      'תמיכה בעדיפות',
    ],
    cta: 'שדרג לפרו',
  },
  {
    id: 'business',
    name: 'עסקי',
    price: '249',
    period: '/חודש',
    features: [
      'הכל בפרו',
      'מספר משתמשים',
      'דו"חות PDF מפורטים',
      'גישת API',
      'אינטגרציות מתקדמות',
      'מנהל חשבון ייעודי',
    ],
    cta: 'שדרג לעסקי',
  },
];

export default function PricingPage() {
  const { user, loadUser } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('התשלום בוצע בהצלחה! התוכנית עודכנה');
      loadUser();
    } else if (searchParams.get('canceled') === 'true') {
      toast('התשלום בוטל', { icon: 'ℹ️' });
    }
  }, []);

  const currentPlan = user?.plan || 'free';

  const handleUpgrade = async (planId: 'pro' | 'business') => {
    setLoading(planId);
    try {
      const url = await paymentsApi.createCheckoutSession(planId);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה ביצירת תשלום');
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading('manage');
    try {
      const url = await paymentsApi.getPortalUrl();
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה');
      setLoading(null);
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">בחר את התוכנית שלך</h1>
        <p className="text-gray-500">שדרג כדי לקבל גישה מלאה לכל הכלים</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isUpgrade = plan.id !== 'free' && !isCurrent;
          const isDowngrade = plan.id === 'free' && currentPlan !== 'free';

          return (
            <div
              key={plan.id}
              className={`card relative ${plan.popular ? 'border-primary-500 border-2 shadow-lg' : ''} ${
                isCurrent ? 'ring-2 ring-primary-500 ring-offset-2' : ''
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  הכי פופולרי
                </div>
              )}

              {/* Current plan badge */}
              {isCurrent && (
                <div className="absolute -top-3 right-4 bg-success-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  התוכנית שלך
                </div>
              )}

              <div className="text-center mb-6 pt-2">
                <h2 className="text-xl font-bold mb-2">{plan.name}</h2>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">₪{plan.price}</span>
                  {plan.period && <span className="text-gray-500 text-sm">{plan.period}</span>}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-success-500 flex-shrink-0">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                {isCurrent && currentPlan !== 'free' ? (
                  <button
                    onClick={handleManage}
                    disabled={loading === 'manage'}
                    className="btn-secondary w-full"
                  >
                    {loading === 'manage' ? 'טוען...' : 'נהל מנוי'}
                  </button>
                ) : isUpgrade ? (
                  <button
                    onClick={() => handleUpgrade(plan.id as 'pro' | 'business')}
                    disabled={loading === plan.id}
                    className={`w-full ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {loading === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        מעביר לתשלום...
                      </span>
                    ) : (
                      plan.cta
                    )}
                  </button>
                ) : isDowngrade ? (
                  <button disabled className="btn-secondary w-full opacity-50 cursor-not-allowed">
                    תוכנית בסיסית
                  </button>
                ) : (
                  <button disabled className="btn-secondary w-full opacity-50 cursor-not-allowed">
                    {plan.cta}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ / info */}
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <p className="text-sm text-gray-500">
          ניתן לבטל את המנוי בכל עת. התשלום מתבצע באופן מאובטח דרך Stripe.
        </p>
        <p className="text-sm text-gray-500 mt-1">
          לשאלות ותמיכה: support@priceguard.co.il
        </p>
      </div>
    </div>
  );
}
