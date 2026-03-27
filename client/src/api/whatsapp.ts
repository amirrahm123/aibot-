import api from './client';

export async function startVerification(phone: string): Promise<{ message: string; phoneMasked: string }> {
  const res = await api.post<{ message: string; phoneMasked: string }>('/integrations/whatsapp/verify/start', { phone });
  return res.data;
}

export async function confirmVerification(code: string): Promise<{ message: string; phone: string }> {
  const res = await api.post<{ message: string; phone: string }>('/integrations/whatsapp/verify/confirm', { code });
  return res.data;
}

export async function disconnectWhatsApp(): Promise<void> {
  await api.post('/integrations/whatsapp/disconnect');
}

export async function sendTestMessage(): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>('/integrations/whatsapp/test');
  return res.data;
}
