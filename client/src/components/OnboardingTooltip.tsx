import { useEffect, useState, useRef } from 'react';
import { useOnboardingStore } from '../store/onboardingStore';

interface OnboardingTooltipProps {
  id: string;
  targetRef: React.RefObject<HTMLElement | null>;
  text: string;
  position?: 'top' | 'bottom';
}

export default function OnboardingTooltip({ id, targetRef, text, position = 'bottom' }: OnboardingTooltipProps) {
  const { completed, wasTooltipShown, markTooltipShown } = useOnboardingStore();
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (completed || wasTooltipShown(id)) return;
    // Small delay so the page renders first
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, [id, completed]);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    markTooltipShown(id);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-[55]" onClick={handleDismiss} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`absolute z-[56] bg-primary-500 text-white rounded-xl px-4 py-3 shadow-lg max-w-[280px] text-sm leading-relaxed ${
          position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}
        style={{ right: 0 }}
      >
        <p>{text}</p>
        <button
          onClick={handleDismiss}
          className="mt-2 text-xs text-primary-100 hover:text-white underline"
        >
          הבנתי
        </button>
        {/* Arrow */}
        <div
          className={`absolute w-3 h-3 bg-primary-500 rotate-45 right-4 ${
            position === 'top' ? '-bottom-1.5' : '-top-1.5'
          }`}
        />
      </div>
    </>
  );
}
