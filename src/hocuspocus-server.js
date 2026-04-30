import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database'
import { verifyToken } from './middleware/auth.js'
import Document from './models/Document.js';
import DocumentMember from './models/DocumentMember.js';

// 创建 Hocuspocus 服务器
const hocuspocusServer = new Server({
  port: 3001,

   onAuthenticate:async(data)=> { 
    const { token } = data;
    console.log("拿到的token是", token)

    const user = verifyToken(token);
    if (!user) {
      connectionConfig.readOnly = true;
      throw new Error('无效token');
    }
    return {
      user
    };
  },
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
              updated_at: new Date(),
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

  // 文档加载前的钩子 - 验证权限
  onLoadDocument: async (data) => {
    console.log("用户开始加载文档")
    const { documentName, context } = data;
    console.log("用户开始解构数据")
    // documentName 就是你的 documentId
    const documentId = documentName;
    const userId = context.userId;

    console.log(`用户 ${context.username} 尝试加载文档 ${documentId}`);

    // 从数据库验证用户是否有权限访问该文档
    const hasAccess = await DocumentMember.exists({
      document_id: documentId,
      user_id: userId
    });

    if (!hasAccess) {
      throw new Error('无权限访问该文档');
    }

    // 可以在这里记录文档访问日志
    console.log(`用户 ${context.username} 成功加载文档 ${documentId}`);

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
    const { documentName } = data;

    // 可选：更新数据库中的 updated_at 字段
    await Document.findByIdAndUpdate(documentName, {
      updated_at: new Date()
    }).catch(err => console.error('更新 updated_at 失败:', err));

    // 可选：广播给其他用户（Hocuspocus 会自动处理，这里只是做额外记录）
    // console.log(`文档 ${documentName} 有更新`);
  },

  // 用户连接时的自定义处理
  onConnect: async (data) => {
    console.log("data中的实际属性", Object.getOwnPropertyNames(data))

    const { context, requestParameters, connectionConfig } = data;

    // const token = requestParameters?.get('token');
    console.log("context", context)
    // 将用户信息附加到 context
    context.userId = user.userId;
    context.username = user.username;
    context.role = user.role;

    console.log(`用户 ${context.username} 连接 `);
    return data;

  },

  // 用户断开连接
  onDisconnect: async (data) => {
    const { context } = data;
    console.log(`用户 ${context.username} 已断开`);
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