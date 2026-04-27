import { Server } from '@hocuspocus/server';
import { MongoDB } from '@hocuspocus/extension-mongodb';
import { verifyToken } from './middleware/auth.js'
import Document from './models/Document.js';
import DocumentMember from './models/DocumentMember.js';

// 创建 Hocuspocus 服务器
const hocuspocusServer = Server.configure({
  port: 3001,  // WebSocket 端口，可以和 HTTP 不同

  // 扩展插件
  extensions: [
    // MongoDB 持久化扩展（自动保存 Yjs 数据）
    new MongoDB({
      connectionURL: process.env.MONGODB_URL || 'mongodb://localhost:27017',
      databaseName: process.env.DB_NAME || 'EditorTogether',
      flushSize: 100,           // 每 100 个操作刷新一次
      flushInterval: 2000,      // 或每 2 秒刷新一次
      // 注意：Hocuspocus 会自动管理版本，不需要我们手动处理快照
    }),

  ],

  // 文档加载前的钩子 - 验证权限
  onLoadDocument: async (data) => {
    const { documentName, context } = data;
    // documentName 就是你的 documentId
    const documentId = documentName;
    const userId = context.userId;

    console.log(`用户 ${userId} 尝试加载文档 ${documentId}`);

    // 从数据库验证用户是否有权限访问该文档
    const hasAccess = await DocumentMember.exists({
      document_id: documentId,
      user_id: userId
    });

    if (!hasAccess) {
      throw new Error('无权限访问该文档');
    }

    // 可以在这里记录文档访问日志
    console.log(`用户 ${userId} 成功加载文档 ${documentId}`);

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

  // 文档变更时的钩子（可用于实时通知）
  onUpdate: async (data) => {
    const { documentName, context, update } = data;

    // 可选：更新数据库中的 updated_at 字段
    await Document.findByIdAndUpdate(documentName, {
      updated_at: new Date()
    }).catch(err => console.error('更新 updated_at 失败:', err));

    // 可选：广播给其他用户（Hocuspocus 会自动处理，这里只是做额外记录）
    // console.log(`文档 ${documentName} 有更新`);
  },

  // 用户连接时的自定义处理
  onConnect: async (data) => {
    const { context, connection,request } = data;

    // 可以在这里添加自定义的 connection 扩展
    connection.readOnly = false;  // 允许读写

    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    const user = verifyToken(token);
    if (!user) {
      connection.readOnly = true;
      throw new Error('无效token');
    }

    // 将用户信息附加到 context
    context.userId = user.userId;
    context.username = user.username;
    context.role = user.role;

    console.log(`用户 ${user.username} 连接 `);
    return data;

  },

  // 用户断开连接
  onDisconnect: async (data) => {
    const { context } = data;
    console.log(`用户 ${context.userId} 已断开`);
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
function setupWebSocket(server) {
  // 如果想把 WebSocket 挂载到已有的 HTTP 服务器上
  if (server) {
    hocuspocusServer.configure({
      server,  // 复用已有的 HTTP 服务器
      port: undefined  // 不指定端口，使用 HTTP 服务器的端口
    });
  }

  hocuspocusServer.listen();
  console.log(`Hocuspocus WebSocket 服务器已启动`);

  return hocuspocusServer;
}

module.exports = { setupWebSocket, hocuspocusServer };