import api from './client';
import { INotification } from '@shared/types';

interface NotificationsResponse {
  notifications: INotification[];
  unreadCount: number;
}

export async function getNotifications(): Promise<NotificationsResponse> {
  const res = await api.get<NotificationsResponse>('/notifications');
  return res.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get<{ unreadCount: number }>('/notifications/unread-count');
  return res.data.unreadCount;
}

export async function markAsRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}
