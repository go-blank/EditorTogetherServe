import express from 'express';
import puppeteer from 'puppeteer-core';
import { authMiddleware } from '../middleware/auth.js';
import Document from '../models/Document.js';

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export function createExportApiRouter() {
  const router = express.Router();

  // ========== 导出 HTML 为 PDF ==========
  router.post('/export/pdf', authMiddleware, async (req, res) => {
    let browser = null;
    try {
      const { title, htmlContent } = req.body;

      if (!htmlContent) {
        return res.status(400).json({ code: 400, error: '缺少文档内容' });
      }

      const docTitle = title || '未命名文档';
      const dateStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

      // 构建完整 HTML 页面（带样式）
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${docTitle}</title>
  <style>
    @page {
      margin: 20mm 25mm;
    }
    body {
      font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #1f2937;
      padding: 0;
      margin: 0;
    }
    .doc-header {
      text-align: center;
      padding-bottom: 20px;
      margin-bottom: 24px;
      border-bottom: 2px solid #e5e7eb;
    }
    .doc-header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 8px 0;
    }
    .doc-header .date {
      font-size: 12px;
      color: #9ca3af;
    }
    .doc-content h1 { font-size: 1.8em; margin: 0.8em 0 0.4em; font-weight: bold; color: #111827; }
    .doc-content h2 { font-size: 1.5em; margin: 0.7em 0 0.35em; font-weight: bold; color: #1f2937; }
    .doc-content h3 { font-size: 1.25em; margin: 0.6em 0 0.3em; font-weight: bold; color: #374151; }
    .doc-content p { margin: 0 0 1em; }
    .doc-content ul, .doc-content ol { padding-left: 2em; margin: 0 0 1em; }
    .doc-content li { margin-bottom: 0.3em; }
    .doc-content blockquote {
      border-left: 4px solid #d1d5db;
      padding-left: 16px;
      margin: 0 0 1em;
      color: #6b7280;
      font-style: italic;
    }
    .doc-content pre {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px 16px;
      overflow-x: auto;
      font-family: "JetBrains Mono", "Fira Code", monospace;
      font-size: 13px;
      line-height: 1.6;
      margin: 0 0 1em;
    }
    .doc-content code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: "JetBrains Mono", "Fira Code", monospace;
      font-size: 0.9em;
    }
    .doc-content pre code {
      background: none;
      padding: 0;
      font-size: inherit;
    }
    .doc-content img { max-width: 100%; height: auto; }
    .doc-content a { color: #2563eb; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="doc-header">
    <h1>${docTitle}</h1>
    <div class="date">导出时间：${dateStr}</div>
  </div>
  <div class="doc-content">
    ${htmlContent}
  </div>
</body>
</html>`;

      // 启动 puppeteer（使用系统 Chrome）
      browser = await puppeteer.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      // 生成 PDF
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '25mm', right: '25mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `
          <div style="width:100%; text-align:center; font-size:10px; color:#9ca3af; padding:0 25mm;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `,
      });

      await browser.close();
      browser = null;

      // 返回 PDF 文件
      const safeName = encodeURIComponent(docTitle);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      res.send(pdf);

    } catch (error) {
      console.error('导出 PDF 失败:', error.message);
      if (browser) {
        try { await browser.close(); } catch (e) { /* ignore */ }
      }
      // 检查是否是 puppeteer 启动错误
      if (error.message?.includes('Failed to launch')) {
        return res.status(500).json({
          code: 500,
          error: 'PDF 生成服务不可用，请检查 Chrome 安装路径',
          detail: error.message
        });
      }
      res.status(500).json({ code: 500, error: '导出 PDF 失败: ' + error.message });
    }
  });

  // ========== 从文档直接导出 PDF（根据文档 ID） ==========
  router.get('/export/pdf/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({ code: 404, error: '文档未找到' });
      }

      // 如果有 Yjs 二进制数据，尝试提取纯文本作为内容
      let htmlContent = '<p>（文档内容为空）</p>';
      if (document.yjs_data) {
        // 简单处理：直接从数据库中存储的内容提取
        // 由于 Yjs 二进制数据解析复杂，这里使用占位提示
        htmlContent = '<p>请打开文档后使用编辑器中的"导出 PDF"按钮导出完整内容。</p>';
        htmlContent += `<p>文档标题：${document.title}</p>`;
        htmlContent += `<p>创建者：${document.created_by_name}</p>`;
        htmlContent += `<p>更新时间：${document.updated_at ? new Date(document.updated_at).toLocaleString('zh-CN') : '-'}</p>`;
      }

      // 复用 HTML 转 PDF 的逻辑，转发到自身
      const pdfRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/export/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization
        },
        body: JSON.stringify({ title: document.title, htmlContent })
      });

      if (!pdfRes.ok) {
        const errData = await pdfRes.json().catch(() => ({}));
        return res.status(500).json({ code: 500, error: errData.error || '导出失败' });
      }

      const pdf = await pdfRes.arrayBuffer();
      const safeName = encodeURIComponent(document.title);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      res.setHeader('Content-Length', pdf.byteLength);
      res.send(Buffer.from(pdf));

    } catch (error) {
      console.error('导出文档 PDF 失败:', error.message);
      res.status(500).json({ code: 500, error: '导出失败: ' + error.message });
    }
  });

  return router;
}
