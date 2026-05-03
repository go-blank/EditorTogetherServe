
import express from 'express';
import 'dotenv/config';
import { authMiddleware } from '../middleware/auth.js';

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
      messages: content
    })
  })
    .then(response => response.json())
    .then(data => data)
    .catch(error => console.error('Error:', error));
}

export function deepSeekApiRouter() {
  router.post('/deepSeek/chat', authMiddleware, async (req, res) => {

    const content = req.body.messages

    console.log("content的内容是", content)

    const resAi = await deepseekChat(content)

    res.json({
      code: 200,
      message: 'ai对话成功',
      data: resAi
    });

  })

  return router
}