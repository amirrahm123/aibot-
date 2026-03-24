import api from './client';
import type { GmailConnectionStatus } from '@shared/types';

export async function getGmailStatus(): Promise<GmailConnectionStatus> {
  const res = await api.get<GmailConnectionStatus>('/gmail/status');
  return res.data;
}

export async function getGmailConnectUrl(): Promise<string> {
  const res = await api.get<{ authUrl: string }>('/gmail/connect');
  return res.data.authUrl;
}

export async function disconnectGmail(): Promise<void> {
  await api.post('/gmail/disconnect');
}

export async function renewGmailWatch(): Promise<{ expiration: string }> {
  const res = await api.post<{ expiration: string }>('/gmail/renew-watch');
  return res.data;
}
