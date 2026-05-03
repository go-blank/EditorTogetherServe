import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
import User from '../models/user.js'


export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}


export function verifyToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  return {
    userId: decoded.userId || decoded.sub,
    username: decoded.username,
    role: decoded.role,
    department: decoded.department
  };
}

export function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  const [type, value] = auth.split(" ");
  if (type?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

export function nowIso() {
  return new Date().toISOString();
}

export async function authMiddleware(req, res, next) {
  try {
    // 1. 获取 token
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({
        error: "未提供认证令牌",
        code: "MISSING_TOKEN"
      });
    }
    const decoded = verifyToken(token);

    const user = await User.findById({ _id: decoded.userId })
    if (!user) {
      return res.status(401).json({
        error: "用户不存在或已被删除",
        code: "USER_NOT_FOUND"
      });
    }

    req.user = decoded;

    next();
  } catch (err) {
    // 区分不同的 token 错误
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: "令牌已过期，请重新登录",
        code: "TOKEN_EXPIRED"
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: "无效的令牌",
        code: "INVALID_TOKEN"
      });
    } else {
      return res.status(401).json({
        error: "认证失败",
        code: "AUTH_FAILED"
      });
    }
  }
}