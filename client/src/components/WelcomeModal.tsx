import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../store/onboardingStore';

export default function WelcomeModal() {
  const { showWelcome, dismissWelcome } = useOnboardingStore();
  const navigate = useNavigate();

  if (!showWelcome) return null;

  const handleStart = () => {
    dismissWelcome();
    navigate('/app/suppliers');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">👋</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ברוך הבא לשומר המחיר</h2>
        <p className="text-gray-500 mb-6">המערכת שלך לזיהוי חריגות מחיר בחשבוניות ספקים</p>

        <div className="text-right space-y-3 mb-8 bg-gray-50 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-700">בואו נגדיר אותה ב-3 צעדים פשוטים:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center text-sm font-bold">1</span>
              <span className="text-sm text-gray-600">הוסף ספקים</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center text-sm font-bold">2</span>
              <span className="text-sm text-gray-600">הגדר מחירים מוסכמים</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center text-sm font-bold">3</span>
              <span className="text-sm text-gray-600">העלה חשבונית ראשונה</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleStart}
          className="btn-primary w-full text-base py-3"
        >
          בואו נתחיל →
        </button>
        <button
          onClick={dismissWelcome}
          className="text-sm text-gray-400 hover:text-gray-600 mt-3 block mx-auto"
        >
          דלג
        </button>
      </div>
    </div>
  );
}
