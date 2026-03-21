import { useNavigate } from 'react-router-dom';

const features = [
  {
    icon: '🤖',
    title: 'זיהוי AI חכם',
    desc: 'סורק חשבוניות אוטומטית ומסמן מחירים שחורגים מהמחירים המוסכמים',
  },
  {
    icon: '📊',
    title: 'דשבורד מרכזי',
    desc: 'כל הספקים, ההסכמים והחשבוניות במקום אחד — תמונה ברורה של ההוצאות',
  },
  {
    icon: '🔔',
    title: 'התראות WhatsApp',
    desc: 'קבל התראה מיידית כשמזוהה חריגת מחיר — לפני שמאוחר מדי',
  },
];

const plans = [
  {
    name: 'חינם',
    price: '0',
    period: '',
    features: ['עד 2 ספקים', 'עד 10 חשבוניות בחודש', 'זיהוי חריגות מחיר', 'דשבורד בסיסי'],
    cta: 'התחל בחינם',
    popular: false,
  },
  {
    name: 'פרו',
    price: '99',
    period: '/חודש',
    features: ['ספקים ללא הגבלה', 'חשבוניות ללא הגבלה', 'התראות WhatsApp', 'דשבורד מתקדם', 'ייצוא דו"חות', 'תמיכה בעדיפות'],
    cta: 'התחל תקופת ניסיון',
    popular: true,
  },
  {
    name: 'עסקי',
    price: '249',
    period: '/חודש',
    features: ['הכל בפרו', 'מספר משתמשים', 'דו"חות PDF מפורטים', 'גישת API', 'אינטגרציות מתקדמות', 'מנהל חשבון ייעודי'],
    cta: 'צור קשר',
    popular: false,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <h1 className="text-xl font-bold text-primary-500">שומר המחיר</h1>
          <div className="flex gap-3">
            <button onClick={() => navigate('/login')} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2">
              התחבר
            </button>
            <button onClick={() => navigate('/register')} className="text-sm font-medium bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors">
              הרשמה
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary-50 via-white to-blue-50" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
            AI שמגן על{' '}
            <span className="text-primary-500">שולי הרווח</span>{' '}
            שלך
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            זיהוי אוטומטי של חריגות מחיר בחשבוניות ספקים.
            חסוך אלפי שקלים כל חודש.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="bg-primary-500 text-white px-8 py-3.5 rounded-xl text-lg font-semibold hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25"
            >
              התחל בחינם
            </button>
            <button
              onClick={() => navigate('/login')}
              className="bg-white text-gray-700 px-8 py-3.5 rounded-xl text-lg font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              התחבר
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-12">למה PriceGuard?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 text-center">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h4 className="text-lg font-bold mb-2">{f.title}</h4>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-4">תוכניות ומחירים</h3>
          <p className="text-gray-500 text-center mb-12">בחר את התוכנית שמתאימה לעסק שלך</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`bg-white rounded-2xl p-6 md:p-8 border-2 relative ${
                  plan.popular ? 'border-primary-500 shadow-lg' : 'border-gray-100'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    הכי פופולרי
                  </div>
                )}
                <div className="text-center mb-6 pt-2">
                  <h4 className="text-xl font-bold mb-2">{plan.name}</h4>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">₪{plan.price}</span>
                    {plan.period && <span className="text-gray-500 text-sm">{plan.period}</span>}
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-green-500 flex-shrink-0">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/register')}
                  className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                    plan.popular
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h5 className="text-white font-bold text-lg mb-1">שומר המחיר — PriceGuard</h5>
              <p className="text-sm">AI לניהול ובקרת מחירי ספקים</p>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">תנאי שימוש</a>
              <a href="#" className="hover:text-white transition-colors">פרטיות</a>
              <a href="mailto:support@priceguard.co.il" className="hover:text-white transition-colors">צור קשר</a>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            © 2026 PriceGuard. כל הזכויות שמורות.
          </div>
        </div>
      </footer>
    </div>
  );
}
