import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { INotification, NotificationType } from '@shared/types';
import * as notificationsApi from '../api/notifications';

const POLL_INTERVAL = 30_000; // 30 seconds

const TYPE_CONFIG: Record<NotificationType, { icon: string; color: string }> = {
  overcharge_detected: { icon: '⚠️', color: 'bg-red-50 border-red-200' },
  new_invoice: { icon: '📄', color: 'bg-blue-50 border-blue-200' },
  error: { icon: '❌', color: 'bg-red-50 border-red-200' },
  gmail_expiring: { icon: '📧', color: 'bg-yellow-50 border-yellow-200' },
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return 'אתמול';
  return `לפני ${diffDays} ימים`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Poll for unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Load full notifications when dropdown opens
  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const data = await notificationsApi.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNotificationClick = async (notif: INotification) => {
    if (!notif.read) {
      try {
        await notificationsApi.markAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch { /* ignore */ }
    }
    setOpen(false);
    if (notif.invoiceId) {
      navigate(`/app/invoices/${notif.invoiceId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="התראות"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute start-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm">התראות</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary-500 hover:underline"
              >
                סמן הכל כנקרא
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                אין התראות
              </div>
            ) : (
              notifications.map((notif) => {
                const config = TYPE_CONFIG[notif.type];
                return (
                  <button
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-right px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      !notif.read ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <div className="flex gap-3 items-start">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm ${config.color}`}>
                        {config.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className={`text-sm ${!notif.read ? 'font-semibold' : 'font-medium'} text-gray-800 truncate`}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5"></span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{relativeTime(notif.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
