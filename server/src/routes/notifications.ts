import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import Notification from '../models/Notification';

const router = Router();
router.use(authMiddleware);

// GET /api/notifications — latest 15, sorted by createdAt desc
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: req.userId,
      read: false,
    });

    res.json({ notifications, unreadCount });
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת התראות' });
  }
});

// GET /api/notifications/unread-count — just the count (for polling)
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: req.userId,
      read: false,
    });
    res.json({ unreadCount });
  } catch {
    res.status(500).json({ error: 'שגיאה' });
  }
});

// PATCH /api/notifications/:id/read — marks one as read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { read: true } },
      { new: true },
    );
    if (!notification) {
      res.status(404).json({ error: 'התראה לא נמצאה' });
      return;
    }
    res.json(notification);
  } catch {
    res.status(500).json({ error: 'שגיאה בעדכון התראה' });
  }
});

// PATCH /api/notifications/read-all — marks all as read
router.patch('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, read: false },
      { $set: { read: true } },
    );
    res.json({ message: 'כל ההתראות סומנו כנקראות' });
  } catch {
    res.status(500).json({ error: 'שגיאה' });
  }
});

export default router;
