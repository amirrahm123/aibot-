import api from './client';
import { SavingsData, SupplierRisk } from '@shared/types';

export async function getSavings(months = 6): Promise<SavingsData> {
  const res = await api.get<SavingsData>('/analytics/savings', { params: { months } });
  return res.data;
}

export async function getSupplierRisk(): Promise<SupplierRisk[]> {
  const res = await api.get<SupplierRisk[]>('/analytics/supplier-risk');
  return res.data;
}
