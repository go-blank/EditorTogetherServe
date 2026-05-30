import express from 'express';
import Notification from '../models/Notification.js';
import { authMiddleware } from '../middleware/auth.js';

export function createNotificationApiRouter() {
  const router = express.Router();

  // ========== 获取当前用户的消息列表（支持分页） ==========
  router.get('/notifications', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip = parseInt(req.query.skip) || 0;

      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Notification.countDocuments({ userId });

      res.json({
        code: 200,
        data: {
          notifications,
          total,
          hasMore: skip + limit < total
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 获取未读消息总数 ==========
  router.get('/notifications/unread-count', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;
      const count = await Notification.countDocuments({ userId, isRead: false });

      res.json({
        code: 200,
        data: { unreadCount: count }
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 将所有消息标记为已读 ==========
  router.post('/notifications/mark-as-read', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;

      await Notification.updateMany(
        { userId, isRead: false },
        { $set: { isRead: true } }
      );

      res.json({
        code: 200,
        message: '已全部标记为已读'
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 删除当前用户的所有消息 ==========
  router.delete('/notifications', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;

      const result = await Notification.deleteMany({ userId });

      res.json({
        code: 200,
        message: '已删除所有消息',
        data: { deletedCount: result.deletedCount }
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  return router;
}
