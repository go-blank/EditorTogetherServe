
import express from 'express';
import 'dotenv/config';
import { authMiddleware } from '../middleware/auth.js';
import { SYSTEM_PROMPT } from '../services/systemPrompt.js';

const router = express.Router();


function deepseekChat(content) {
  return fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-ai/DeepSeek-V3.2',
      // messages: [
      //   { role: 'system', content: '你是一个有用的助手' },
      //   { role: 'user', content: '你好，请介绍一下你自己' }
      // ]
      messages: content,
      stream: true
    })
  })

}

export function deepSeekApiRouter() {
  router.post('/deepSeek/chat', authMiddleware, async (req, res) => {

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 注入系统知识作为 system prompt
    const userMessages = req.body.messages || []
    const messagesWithContext = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...userMessages
    ]

    const resAi = await deepseekChat(messagesWithContext)

    const reader = resAi.body.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      res.write(value)
    }

    res.end()

  })

  return router
}