import { create } from 'zustand';

export interface OnboardingState {
  completed: boolean;
  showWelcome: boolean;
  showChecklist: boolean;
  steps: {
    registered: boolean;
    addedSupplier: boolean;
    addedAgreement: boolean;
    uploadedInvoice: boolean;
  };
  tooltipsShown: Record<string, boolean>;
  load: () => void;
  markStep: (step: keyof OnboardingState['steps']) => void;
  dismissWelcome: () => void;
  finishOnboarding: () => void;
  resetOnboarding: () => void;
  markTooltipShown: (key: string) => void;
  wasTooltipShown: (key: string) => boolean;
}

const STORAGE_KEY = 'priceguard_onboarding';
const TOOLTIPS_KEY = 'priceguard_tooltips';

function loadFromStorage(): Partial<OnboardingState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadTooltips(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(TOOLTIPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(state: Partial<OnboardingState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    completed: state.completed,
    steps: state.steps,
  }));
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  completed: false,
  showWelcome: false,
  showChecklist: false,
  steps: {
    registered: true,
    addedSupplier: false,
    addedAgreement: false,
    uploadedInvoice: false,
  },
  tooltipsShown: {},

  load: () => {
    const saved = loadFromStorage();
    const tooltips = loadTooltips();
    const completed = saved.completed || false;
    const steps = saved.steps || {
      registered: true,
      addedSupplier: false,
      addedAgreement: false,
      uploadedInvoice: false,
    };
    // Show welcome if not completed and no steps done beyond registration
    const isNew = !completed && !steps.addedSupplier && !steps.addedAgreement && !steps.uploadedInvoice;
    set({
      completed,
      steps,
      showWelcome: isNew,
      showChecklist: !completed,
      tooltipsShown: tooltips,
    });
  },

  markStep: (step) => {
    const state = get();
    const newSteps = { ...state.steps, [step]: true };
    const allDone = newSteps.registered && newSteps.addedSupplier && newSteps.addedAgreement && newSteps.uploadedInvoice;
    const newState = {
      steps: newSteps,
      completed: allDone,
      showChecklist: !allDone,
    };
    set(newState);
    persist({ ...state, ...newState });
  },

  dismissWelcome: () => {
    set({ showWelcome: false });
  },

  finishOnboarding: () => {
    const state = get();
    set({ completed: true, showChecklist: false, showWelcome: false });
    persist({ ...state, completed: true });
  },

  resetOnboarding: () => {
    const freshSteps = {
      registered: true,
      addedSupplier: false,
      addedAgreement: false,
      uploadedInvoice: false,
    };
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOOLTIPS_KEY);
    set({
      completed: false,
      showWelcome: true,
      showChecklist: true,
      steps: freshSteps,
      tooltipsShown: {},
    });
  },

  markTooltipShown: (key) => {
    const tooltips = { ...get().tooltipsShown, [key]: true };
    set({ tooltipsShown: tooltips });
    localStorage.setItem(TOOLTIPS_KEY, JSON.stringify(tooltips));
  },

  wasTooltipShown: (key) => {
    return get().tooltipsShown[key] || false;
  },
}));
