# EditorTogetherServe

Node.js + Express + ws 的多人协作编辑器服务端示例：同一个 HTTP Server 同时提供 **REST API** 与 **WebSocket**。

## 启动

```bash
npm install
npm run start
```

开发模式（自动重启）：

```bash
npm run dev
```

默认端口：`3000`（可用环境变量 `PORT=xxxx` 修改）

## 接口文档

见 `docs/API.md`。

## 配置

- `JWT_SECRET`：JWT 密钥（默认 `dev-secret-change-me`，生产环境务必修改）
- `JWT_EXPIRES_IN`：token 过期时间（默认 `7d`）

