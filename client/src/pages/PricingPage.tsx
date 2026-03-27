import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { PlanType } from '@shared/types';
import * as subscriptionApi from '../api/subscription';

interface PlanInfo {
  id: PlanType;
  name: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  annualTotal: number;
  features: string[];
  popular?: boolean;
}

const WHATSAPP_NUMBER = '9720527044989';

const plans: PlanInfo[] = [
  {
    id: 'free',
    name: 'חינם',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    annualTotal: 0,
    features: [
      '20 חשבוניות לחודש',
      '5 סריקות AI לחודש',
      'זיהוי חריגות מחיר',
      'דשבורד בסיסי',
    ],
  },
  {
    id: 'pro',
    name: 'פרו',
    monthlyPrice: 99,
    annualMonthlyPrice: 79,
    annualTotal: 948,
    popular: true,
    features: [
      'חשבוניות ללא הגבלה',
      'סריקות AI ללא הגבלה',
      'התראות WhatsApp',
      'דשבורד מתקדם',
      'ייצוא דו"חות',
      'תמיכה בעדיפות',
    ],
  },
  {
    id: 'business',
    name: 'עסקי',
    monthlyPrice: 249,
    annualMonthlyPrice: 199,
    annualTotal: 2388,
    features: [
      'הכל בפרו',
      'מספר משתמשים',
      'דו"חות PDF מפורטים',
      'גישת API',
      'אינטגרציות מתקדמות',
      'מנהל חשבון ייעודי',
    ],
  },
];

function getWhatsAppLink(planName: string) {
  const message = encodeURIComponent(`היי, אני מעוניין בתוכנית ${planName} של שומר המחיר`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

export default function PricingPage() {
  const { user, loadUser } = useAuthStore();
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);

  const currentPlan = user?.plan || 'free';
  const canTrial = currentPlan === 'free' && !user?.isTrial && !user?.trialEndsAt;

  const handleStartTrial = async () => {
    setStartingTrial(true);
    try {
      await subscriptionApi.startTrial();
      toast.success('הניסיון החינמי התחיל! יש לך 14 ימים של גישה מלאה.');
      loadUser();
      navigate('/app/dashboard');
    } catch {
      toast.error('שגיאה בהתחלת ניסיון');
    } finally {
      setStartingTrial(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">בחר את התוכנית שלך</h1>
        <p className="text-gray-500 mb-6">שדרג כדי לקבל גישה מלאה לכל הכלים</p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 bg-gray-100 rounded-full p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !annual ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
            }`}
          >
            חודשי
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              annual ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
            }`}
          >
            שנתי
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const price = annual ? plan.annualMonthlyPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.id}
              className={`card relative ${plan.popular ? 'border-primary-500 border-2 shadow-lg' : ''} ${
                isCurrent ? 'ring-2 ring-primary-500 ring-offset-2' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  הכי פופולרי
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 right-4 bg-success-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {user?.isTrial ? 'ניסיון פעיל' : 'התוכנית שלך'}
                </div>
              )}

              <div className="text-center mb-6 pt-2">
                <h2 className="text-xl font-bold mb-2">{plan.name}</h2>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold transition-all duration-300">₪{price}</span>
                  {price > 0 && <span className="text-gray-500 text-sm">/חודש</span>}
                </div>
                {annual && plan.annualTotal > 0 && (
                  <div className="mt-1">
                    <span className="text-xs text-gray-400">₪{plan.annualTotal} לשנה</span>
                    <span className="inline-block ms-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      !חסכון של 2 חודשים
                    </span>
                  </div>
                )}
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
                {plan.id === 'free' ? (
                  <button disabled className="btn-secondary w-full opacity-50 cursor-not-allowed">
                    {isCurrent ? 'התוכנית הנוכחית' : 'תוכנית בסיסית'}
                  </button>
                ) : plan.id === 'pro' && canTrial ? (
                  <button
                    onClick={handleStartTrial}
                    disabled={startingTrial}
                    className="w-full py-2.5 px-4 rounded-lg font-medium transition-colors bg-primary-500 hover:bg-primary-600 text-white min-h-[44px]"
                  >
                    {startingTrial ? 'מתחיל...' : 'נסה פרו בחינם ל-14 יום'}
                  </button>
                ) : (
                  <a
                    href={getWhatsAppLink(plan.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block text-center w-full py-2.5 px-4 rounded-lg font-medium transition-colors min-h-[44px] ${
                      plan.popular
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-green-100 hover:bg-green-200 text-green-800'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      צור קשר
                    </span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="max-w-2xl mx-auto mt-12 text-center">
        <p className="text-sm text-gray-500">
          להצטרפות לתוכנית או לשאלות, צרו קשר בוואטסאפ ונחזור אליכם בהקדם.
        </p>
        <p className="text-sm text-gray-500 mt-1">
          לשאלות ותמיכה: support@priceguard.co.il
        </p>
      </div>
    </div>
  );
}
