import api from './client';
import { IInvoice, PaginatedResponse, DashboardStats } from '@shared/types';

export async function uploadInvoice(file: File, supplierId: string): Promise<IInvoice> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('supplierId', supplierId);
  const res = await api.post<IInvoice>('/invoices/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function getInvoices(params: {
  page?: number;
  limit?: number;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  overchargeOnly?: boolean;
  search?: string;
} = {}): Promise<PaginatedResponse<IInvoice>> {
  const res = await api.get<PaginatedResponse<IInvoice>>('/invoices', { params });
  return res.data;
}

export async function getInvoice(id: string): Promise<IInvoice> {
  const res = await api.get<IInvoice>(`/invoices/${id}`);
  return res.data;
}

export async function deleteInvoice(id: string): Promise<void> {
  await api.delete(`/invoices/${id}`);
}

export async function reprocessInvoice(id: string): Promise<IInvoice> {
  const res = await api.post<IInvoice>(`/invoices/${id}/reprocess`);
  return res.data;
}

export async function getInvoiceReport(id: string): Promise<Blob> {
  const res = await api.get(`/invoices/${id}/report`, { responseType: 'blob' });
  return res.data;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<DashboardStats>('/dashboard/stats');
  return res.data;
}
