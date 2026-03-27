import api from './client';

export async function startTrial(): Promise<{ message: string; trialEndsAt: string }> {
  const res = await api.post<{ message: string; trialEndsAt: string }>('/subscription/trial/start');
  return res.data;
}

export async function convertTrial(): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>('/subscription/trial/convert');
  return res.data;
}
