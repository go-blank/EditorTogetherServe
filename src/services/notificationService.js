import { WebSocketServer } from 'ws';
import { verifyToken } from '../middleware/auth.js';

const MAX_CONNECTIONS_PER_USER = 5;    // 单用户最大连接数
const HEARTBEAT_INTERVAL = 30000;      // ping 间隔 (30s)
const PONG_TIMEOUT = 10000;            // pong 超时 (10s)

class NotificationService {
  constructor() {
    this.wss = null;
    /** @type {Map<string, Set<WebSocket>>} */
    this.userConnections = new Map();
  }

  /**
   * 初始化 WebSocket 服务器
   */
  init(server) {
    this.wss = new WebSocketServer({ server, path: '/ws/notifications' });

    this.wss.on('connection', (ws, req) => {
      const token = this._extractToken(req);
      if (!token) {
        ws.close(4001, '缺少 token');
        return;
      }

      let user;
      try {
        user = verifyToken(token);
      } catch {
        ws.close(4001, '无效 token');
        return;
      }

      const userIdStr = user.userId.toString();

      // 标记连接归属
      ws._userId = userIdStr;
      ws._username = user.username;
      ws._isAlive = true;
      ws._pongTimeout = null;

      // 加入用户连接池（含去重控制）
      this._addConnection(userIdStr, ws);

      // 启动心跳
      this._startHeartbeat(ws);

      // 事件监听
      ws.on('pong', () => {
        ws._isAlive = true;
        this._clearPongTimeout(ws);
      });

      ws.on('close', () => {
        this._removeConnection(ws);
      });

      ws.on('error', () => {
        this._removeConnection(ws);
      });
    });

    // 全局心跳巡检：定期清理失活连接
    this._healthCheckTimer = setInterval(() => {
      this._healthCheck();
    }, HEARTBEAT_INTERVAL);

    console.log('[通知WS] 服务已启动 (路径: /ws/notifications)');
  }

  /**
   * 从请求 URL 中提取 token
   */
  _extractToken(req) {
    try {
      const url = new URL(req.url, 'http://localhost');
      return url.searchParams.get('token');
    } catch {
      return null;
    }
  }

  /**
   * 添加连接，先清理僵尸连接，再超限时关闭最旧的
   */
  _addConnection(userId, ws) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }

    const connections = this.userConnections.get(userId);

    // 1. 先清理所有僵尸连接（已关闭但没走 remove 的）
    let cleaned = 0;
    connections.forEach(conn => {
      if (conn.readyState !== 1) { // 不是 OPEN 状态
        this._removeConnection(conn);
        cleaned++;
      }
    });
    if (cleaned > 0) {
      console.log(`[通知WS] 用户 ${userId} 清理了 ${cleaned} 条僵尸连接`);
    }

    // 2. 如果还是超过最大限制，关闭最旧的一条
    if (connections.size >= MAX_CONNECTIONS_PER_USER) {
      const oldest = connections.values().next().value;
      if (oldest) {
        oldest.close(4000, '连接数超限');
        this._removeConnection(oldest);
      }
    }

    connections.add(ws);
  }

  /**
   * 移除连接
   */
  _removeConnection(ws) {
    this._clearHeartbeat(ws);
    this._clearPongTimeout(ws);

    const userId = ws._userId;
    if (!userId) return;

    const connections = this.userConnections.get(userId);
    if (!connections) return;

    connections.delete(ws);
    if (connections.size === 0) {
      this.userConnections.delete(userId);
    }
  }

  /**
   * 启动心跳：定时 ping，超时未 pong 则关闭
   */
  _startHeartbeat(ws) {
    ws._heartbeatInterval = setInterval(() => {
      if (ws.readyState !== 1) {
        this._removeConnection(ws);
        return;
      }

      ws._isAlive = false;
      ws.ping();

      // 设置 pong 超时检测
      ws._pongTimeout = setTimeout(() => {
        if (!ws._isAlive) {
          ws.terminate(); // 强制关闭无响应的连接
          this._removeConnection(ws);
        }
      }, PONG_TIMEOUT);

    }, HEARTBEAT_INTERVAL);
  }

  _clearHeartbeat(ws) {
    if (ws._heartbeatInterval) {
      clearInterval(ws._heartbeatInterval);
      ws._heartbeatInterval = null;
    }
  }

  _clearPongTimeout(ws) {
    if (ws._pongTimeout) {
      clearTimeout(ws._pongTimeout);
      ws._pongTimeout = null;
    }
  }

  /**
   * 全局健康检查：清理所有失活连接
   */
  _healthCheck() {
    let totalRemoved = 0;
    this.userConnections.forEach((connections, userId) => {
      connections.forEach(ws => {
        if (ws.readyState !== 1) {
          this._removeConnection(ws);
          totalRemoved++;
        }
      });
    });
    if (totalRemoved > 0) {
      console.log(`[通知WS] 健康检查清理了 ${totalRemoved} 条异常连接`);
    }
  }

  /**
   * 向指定用户发送消息
   */
  sendToUser(userId, data) {
    const userIdStr = userId.toString();
    const connections = this.userConnections.get(userIdStr);
    if (!connections || connections.size === 0) return false;

    const message = JSON.stringify(data);
    let sent = 0;
    let closed = 0;

    connections.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(message);
        sent++;
      } else {
        closed++;
        this._removeConnection(ws);
      }
    });

    if (closed > 0) {
      console.log(`[通知WS] 发送消息时清理了 ${closed} 条失效连接`);
    }

    return sent > 0;
  }

  /**
   * 向多个用户广播消息
   */
  broadcastToUsers(userIds, data) {
    userIds.forEach(userId => this.sendToUser(userId, data));
  }

  /**
   * 获取在线用户统计
   */
  getStats() {
    let totalConnections = 0;
    this.userConnections.forEach(conns => {
      totalConnections += conns.size;
    });
    return {
      onlineUsers: this.userConnections.size,
      totalConnections,
    };
  }

  /**
   * 获取当前在线用户数
   */
  getOnlineCount() {
    return this.userConnections.size;
  }

  /**
   * 关闭服务（用于优雅关闭）
   */
  close() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
    }
    if (this.wss) {
      this.wss.close();
    }
    this.userConnections.clear();
  }
}

export const notificationService = new NotificationService();
