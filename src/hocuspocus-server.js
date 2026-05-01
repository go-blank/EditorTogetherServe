import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database'
import { verifyToken } from './middleware/auth.js'
import Document from './models/Document.js';
import DocumentMember from './models/DocumentMember.js';

import debounce from 'debounce'

const debouncedUpdate = debounce(async (documentName, user) => {
  try {
    // 直接更新你的 Document 表
    await Document.findByIdAndUpdate(documentName, {
      updated_by: user.userId,             // 用户ID
      updated_by_name: user.username,     // 用户名
      updated_at: Date.now()             // 更新时间
    });
    console.log('✅ 已更新最后修改人：', user.username);
  } catch (err) {
    console.error('更新失败', err);
  }
}, 1000);

// 创建 Hocuspocus 服务器
const hocuspocusServer = new Server({
  port: 3001,
  // 扩展插件
  extensions: [
    new Database({
      fetch: async ({ documentName, document }) => {
        try {
          const doc = await Document.findOne({ _id: documentName });
          return doc?.yjs_data || null;
        } catch (error) {
          console.error(`获取文档${documentName}内容失败:`, error);
          return null;
        }
      },

      store: async ({ documentName, state, lastContext, document }) => {

        try {
          if (!(state instanceof Uint8Array)) {
            console.error(`非法的文档类型 ${documentName}:`, typeof state);
            return;
          }

          await Document.findByIdAndUpdate(
            documentName,
            {
              yjs_data: state,
              updated_at: Date.now(),
              updated_by: lastContext.userId,
              updated_by_name: lastContext.username
            },
            { upsert: true }
          );
        } catch (error) {
          console.error(`写入文档 ${documentName}失败:`, error);
        }
      }
    })

  ],

  onAuthenticate: async (data) => {

    const { token, context } = data;
    console.log("拿到的token是", token)

    const user = verifyToken(token);
    if (!user) {
      connectionConfig.readOnly = true;
      throw new Error('无效token');
    }
    return {
      user
    }
  },

  // 文档加载前的钩子 - 验证权限
  onLoadDocument: async (data) => {
    console.log("用户开始加载文档")

    const { documentName, context } = data;
    console.log("context", context.user)
    console.log("documentName", documentName)
    // documentName 就是你的 documentId
    const documentId = documentName;
    const userId = context.user?.userId;

    console.log(`用户 ${context.user?.username} 尝试加载文档 ${documentId}`);

    const ifExists = await Document.findOne({
      _id: documentId,
      status: { $ne: 'deleted' } // 不等于 deleted
    });

    if (!ifExists) {
      throw new Error('文档已被删除');
    }

    // 可以在这里记录文档访问日志
    console.log(`用户 ${context.user?.username} 成功加载文档 ${documentId}`);

    return data;  // 继续加载文档
  },

  // 文档创建时的钩子（首次创建）
  onCreateDocument: async (data) => {
    const { documentName, context } = data;
    const documentId = documentName;
    const userId = context.userId;

    console.log(`首次创建文档 ${documentId}，创建者 ${userId}`);

    // 注意：文档应该已经通过 API 创建并有了成员记录
    // 这里只做二次确认，如果数据库中没有该文档的记录，可以自动创建
    const document = await Document.findById(documentId);
    if (!document) {
      // 这种情况理论上不应该发生，因为应该先调用 API 创建
      console.warn(`文档 ${documentId} 在数据库中不存在，但 WebSocket 尝试连接`);

      // 可以选择自动创建（备选方案）
      // const newDoc = new Document({
      //   _id: documentId,
      //   title: '新文档',
      //   created_by: userId,
      //   workspace_id: 'default'
      // });
      // await newDoc.save();
      // 
      // const member = new DocumentMember({
      //   document_id: documentId,
      //   user_id: userId
      // });
      // await member.save();
    }

    return data;
  },

  onChange: async (data) => {
    const { documentName, context } = data;

    const user = context.user;
    if (!user) return;

    debouncedUpdate(documentName, user);
  },

  // 用户连接时的自定义处理
  onConnect: async (data) => {
    console.log("用户", data.context.user?.username, "已连接上", data.documentName)
    return data;

  },

  // 用户断开连接
  onDisconnect: async (data) => {
    const { context } = data;
    console.log(`用户 ${context.user?.username} 已断开`);
  },

  // 配置心跳间隔（保持连接）
  heartbeatInterval: 30000,  // 30秒

  // 是否允许跨域
  cors: {
    origin: '*',  // 生产环境限制具体域名
    credentials: true
  },

  // 超时设置
  timeout: 30000,
});

// 启动 WebSocket 服务器
function setupWebSocket() {
  hocuspocusServer.listen();
  console.log(`Hocuspocus WebSocket 服务器已启动`);

  return hocuspocusServer;
}

export { setupWebSocket, hocuspocusServer };