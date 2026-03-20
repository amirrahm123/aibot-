import api from './client';
import { ISupplier, CreateSupplierRequest } from '@shared/types';

export async function getSuppliers(all?: boolean): Promise<ISupplier[]> {
  const params = all ? { all: 'true' } : {};
  const res = await api.get<ISupplier[]>('/suppliers', { params });
  return res.data;
}

export async function createSupplier(data: CreateSupplierRequest): Promise<ISupplier> {
  const res = await api.post<ISupplier>('/suppliers', data);
  return res.data;
}

export async function updateSupplier(id: string, data: Partial<CreateSupplierRequest & { isActive: boolean }>): Promise<ISupplier> {
  const res = await api.put<ISupplier>(`/suppliers/${id}`, data);
  return res.data;
}

export async function deleteSupplier(id: string): Promise<void> {
  await api.delete(`/suppliers/${id}`);
}
