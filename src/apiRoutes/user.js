import express from "express";
import User from '../models/user.js'
import { signToken, nowIso, authMiddleware } from '../middleware/auth.js'

 export function createUserApiRouter() {
  if (typeof signToken !== "function") throw new Error("createApiRouter requires signToken(payload)");
  if (typeof authMiddleware !== "function") throw new Error("createApiRouter requires authMiddleware");
  if (typeof nowIso !== "function") throw new Error("createApiRouter requires nowIso()");

  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({ ok: true, time: nowIso() });
  });

  // 登录
  router.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) return res.status(403).json({ error: "用户名或密码错误" });

    const token = signToken({
      sub:  user._id,
      userId: user._id,
      username: user.username,
      role: user.role
    });
    res.json({ code: 200, token, tokenType: "Bearer", user });
  });

  // 注册
  router.post("/auth/register", async (req, res) => {
    const { username, password } = req.body;

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: "用户已存在" });

    const user = new User({
      username,
      password,
      role: "普通用户",
      department: "",
      email: ""
    });
    await user.save(); // 保存到 MongoDB

    const token = signToken({
      sub:  user._id,
      username: user.username,
      role: user.role
    });

    res.json({
      code: 200,
      message: "注册成功",
      token,
      user
    });
  });

  // 验证token
  router.get("/auth/verify", authMiddleware, (req, res) => {
    res.json({ ok: true, user: req.user });
  });

  return router;
}