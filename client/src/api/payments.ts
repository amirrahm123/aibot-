import api from './client';

export async function createCheckoutSession(planId: 'pro' | 'business'): Promise<string> {
  const res = await api.post<{ url: string }>('/payments/create-checkout-session', { planId });
  return res.data.url;
}

export async function getPortalUrl(): Promise<string> {
  const res = await api.get<{ url: string }>('/payments/portal');
  return res.data.url;
}
