import express from 'express';
const router = express.Router();

import Document from '../models/Document.js';
import DocumentMember from '../models/DocumentMember.js';

import { hocuspocusServer } from '../hocuspocus-server.js'
import { authMiddleware } from '../middleware/auth.js';
import mongoose from "mongoose";

export function createDocumentApiRouter() {
  // 新增
  router.post('/ADDdocuments', authMiddleware, async (req, res) => {
    try {
      const { workspace_id, title, initialContent = '' } = req.body;
      const userId = req.user.userId;
      // 生成文档 ID（可以使用 UUID 或 MongoDB ObjectId）
      const documentId = new mongoose.Types.ObjectId().toString();

      // 创建文档记录
      const document = new Document({
        _id: documentId,
        workspace_id,
        title,
        created_by: userId
      });

      await document.save();

      // 添加创建者为成员
      const member = new DocumentMember({
        document_id: documentId,
        user_id: userId
      });
      await member.save();

      // 可选：初始化 Yjs 文档内容（如果 Hocuspocus 会自动创建空文档，可以不用这一步）
      // 如果需要初始内容，需要手动触发一次更新
      if (initialContent) {
        // 可以通过 Hocuspocus 的 API 来初始化内容
        // 或者让前端在第一次连接时写入初始内容
        console.log(`文档 ${documentId} 创建，初始内容将在前端首次连接时写入`);
      }

      res.json({
        code: 200,
        message: '文档创建成功',
        data: {
          id: documentId,
          title: document.title,
          workspace_id: document.workspace_id,
          created_at: document.created_at
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 获取文档列表 ==========
  router.get('/GETdocumentsList', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const { workspace_id, status = 'active', page = 1, limit = 20 } = req.query;

      // 查询用户有权限的文档
      const members = await DocumentMember.find({ user_id: userId })
        .populate('document_id');

      let documents = members
        .map(m => m.document_id)
        .filter(doc => doc && doc.status === status);

      if (workspace_id) {
        documents = documents.filter(doc => doc.workspace_id == workspace_id);
      }

      // 分页
      const start = (page - 1) * limit;
      const paginatedDocs = documents.slice(start, start + limit);

      res.json({
        code: 200,
        data: {
          documents: paginatedDocs.map(doc => ({
            id: doc._id,
            title: doc.title,
            workspace_id: doc.workspace_id,
            updated_at: doc.updated_at,
            created_at: doc.created_at,
            created_by: doc.created_by
          })),
          total: documents.length,
          page,
          limit
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 获取单个文档详情 ==========
  router.get('/GetdocumentsById/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      // 验证权限
      const hasAccess = await DocumentMember.exists({
        document_id: id,
        user_id: userId
      });

      if (!hasAccess) {
        return res.status(403).json({ code: 403, error: 'No permission' });
      }

      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({ code: 404, error: 'Document not found' });
      }

      res.json({
        code: 200,
        data: {
          id: document._id,
          title: document.title,
          workspace_id: document.workspace_id,
          created_at: document.created_at,
          updated_at: document.updated_at,
          created_by: document.created_by
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 更新文档元数据 ==========
  router.put('/Updatedocuments/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, status } = req.body;
      const userId = req.user.userId;

      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({ code: 404, error: '未找到该文档' });
      }

      // 只有创建者可以修改元数据
      if (document.created_by.toString() !== userId) {
        return res.status(403).json({ code: 403, error: '只有创建者可以修改数据' });
      }

      if (title) document.title = title;
      if (status) document.status = status;

      await document.save();

      res.json({
        code: 200,
        message: '文档更新成功',
        data: {
          id: document._id,
          title: document.title,
          status: document.status,
          updated_at: document.updated_at
        }
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 删除文档（软删除） ==========
  router.delete('/Removedocuments/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({ code: 404, error: '未找到文档' });
      }

      // 只有创建者可以删除
      if (document.created_by.toString() !== userId) {
        return res.status(403).json({ code: 403, error: '只有创建者可以删除文档' });
      }

      document.status = 'deleted';
      await document.save();

      // 注意：Hocuspocus 中的数据不会立即删除，可以保留用于恢复
      // 如果需要彻底删除，可以调用 hocuspocusServer.destroyDocument(id)

      res.json({
        code: 200,
        message: '文档已删除'
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 彻底删除文档（物理删除） ==========
  router.delete('/documents/:id/permanent', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({ code: 404, error: '未找到文档' });
      }

      // 只有创建者可以彻底删除
      if (document.created_by.toString() !== userId) {
        return res.status(403).json({ code: 403, error: '只有创建者可以删除文档' });
      }

      // 从 Hocuspocus 中删除文档数据
      await hocuspocusServer.destroyDocument(id);

      // 删除数据库记录
      await Document.findByIdAndDelete(id);
      await DocumentMember.deleteMany({ document_id: id });

      res.json({
        code: 200,
        message: '文档已永久删除'
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 添加文档成员 ==========
  router.post('/ADDdocumentsMember/:id/members', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { user_id } = req.body;
      const userId = req.user.userId;

      // 验证当前用户是否有权限添加成员
      const hasPermission = await DocumentMember.exists({
        document_id: id,
        user_id: userId
      });

      if (!hasPermission) {
        return res.status(403).json({ code: 403, error: 'No permission to add members' });
      }

      // 检查是否已经是成员
      const alreadyMember = await DocumentMember.exists({
        document_id: id,
        user_id: user_id
      });

      if (alreadyMember) {
        return res.status(400).json({ code: 400, error: 'User is already a member' });
      }

      // 添加成员
      const member = new DocumentMember({
        document_id: id,
        user_id: user_id
      });

      await member.save();

      res.json({
        code: 200,
        message: '成员添加成功'
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 移除文档成员 ==========
  router.delete('/RemovedocumentsMember/:id/members/:userId', authMiddleware, async (req, res) => {
    try {
      const { id, userId: targetUserId } = req.params;
      const userId = req.user.userId;

      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({ code: 404, error: 'Document not found' });
      }

      // 只有创建者可以移除成员（不能移除自己）
      if (document.created_by.toString() !== userId) {
        return res.status(403).json({ code: 403, error: 'Only creator can remove members' });
      }

      // 不能移除创建者自己
      if (targetUserId === userId) {
        return res.status(400).json({ code: 400, error: 'Cannot remove the creator' });
      }

      await DocumentMember.findOneAndDelete({
        document_id: id,
        user_id: targetUserId
      });

      res.json({
        code: 200,
        message: '成员移除成功'
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  // ========== 获取文档成员列表 ==========
  router.get('/GETdocumentsMemberList/:id/members', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const hasAccess = await DocumentMember.exists({
        document_id: id,
        user_id: userId
      });

      if (!hasAccess) {
        return res.status(403).json({ code: 403, error: 'No permission' });
      }

      const members = await DocumentMember.find({ document_id: id })
        .populate('user_id', 'username email role department');

      res.json({
        code: 200,
        data: members.map(m => ({
          user_id: m.user_id._id,
          username: m.user_id.username,
          email: m.user_id.email,
          role: m.user_id.role,
          department: m.user_id.department,
          joined_at: m.joined_at
        }))
      });
    } catch (error) {
      res.status(500).json({ code: 500, error: error.message });
    }
  });

  return router
}
