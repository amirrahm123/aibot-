import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import WelcomeModal from './WelcomeModal';
import OnboardingChecklist from './OnboardingChecklist';

const navItems = [
  { path: '/dashboard', label: 'דשבורד', icon: '📊' },
  { path: '/invoices', label: 'חשבוניות', icon: '📄' },
  { path: '/suppliers', label: 'ספקים', icon: '🏢' },
  { path: '/agreements', label: 'הסכמי מחיר', icon: '💰' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { load: loadOnboarding, resetOnboarding, completed: onboardingCompleted } = useOnboardingStore();

  useEffect(() => {
    loadOnboarding();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-lg md:text-xl font-bold text-primary-500">שומר המחיר</h1>
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-500'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    <span className="ml-1">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              <span className="text-sm text-gray-500 hidden sm:block">{user?.businessName}</span>
              {onboardingCompleted && (
                <button
                  onClick={resetOnboarding}
                  className="text-sm text-gray-400 hover:text-primary-500 hidden md:block"
                  title="סיור מודרך"
                >
                  סיור מודרך
                </button>
              )}
              <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700 hidden md:block">
                התנתק
              </button>
              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="תפריט"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-2 shadow-lg">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-3 py-3 rounded-lg text-base font-medium min-h-[44px] ${
                    isActive ? 'bg-primary-50 text-primary-500' : 'text-gray-600 hover:bg-gray-50'
                  }`
                }
              >
                <span className="ml-2 text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            <div className="border-t border-gray-200 mt-2 pt-2">
              {user?.businessName && (
                <p className="px-3 py-2 text-sm text-gray-500">{user.businessName}</p>
              )}
              {onboardingCompleted && (
                <button
                  onClick={() => { setMobileMenuOpen(false); resetOnboarding(); }}
                  className="w-full text-right px-3 py-3 text-base font-medium text-gray-500 hover:bg-gray-50 rounded-lg min-h-[44px]"
                >
                  סיור מודרך
                </button>
              )}
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="w-full text-right px-3 py-3 text-base font-medium text-danger-500 hover:bg-gray-50 rounded-lg min-h-[44px]"
              >
                התנתק
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <OnboardingChecklist />
        <Outlet />
      </main>

      {/* Onboarding welcome modal */}
      <WelcomeModal />
    </div>
  );
}
