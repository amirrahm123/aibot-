import api from './client';
import { IPriceAgreement, CreateAgreementRequest } from '@shared/types';

export async function getAgreements(supplierId?: string): Promise<IPriceAgreement[]> {
  const params = supplierId ? { supplierId } : {};
  const res = await api.get<IPriceAgreement[]>('/agreements', { params });
  return res.data;
}

export async function createAgreement(data: CreateAgreementRequest): Promise<IPriceAgreement> {
  const res = await api.post<IPriceAgreement>('/agreements', data);
  return res.data;
}

export async function updateAgreement(id: string, data: Partial<CreateAgreementRequest>): Promise<IPriceAgreement> {
  const res = await api.put<IPriceAgreement>(`/agreements/${id}`, data);
  return res.data;
}

export async function deleteAgreement(id: string): Promise<void> {
  await api.delete(`/agreements/${id}`);
}

export async function bulkImportAgreements(items: any[]): Promise<{ created: number; errors: string[] }> {
  const res = await api.post<{ created: number; errors: string[] }>('/agreements/bulk', { items });
  return res.data;
}
