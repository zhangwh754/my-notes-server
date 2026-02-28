// 安装依赖：
import { JSDOM } from 'jsdom';
import StarterKit from '@tiptap/starter-kit';
import Router from 'koa-router';
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import multer from '@koa/multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (ctx, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = new Router({
  prefix: '/api/utils',
});

// 文件上传方式
router.post('/md-convert/file', upload.single('file'), async (ctx) => {
  if (!global.document) {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
  }

  const file = ctx.request.file;

  if (!file) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'No file uploaded' },
    };
    return;
  }

  if (!file.originalname.toLowerCase().endsWith('.md')) {
    try {
      await fs.unlink(file.path);
    } catch (e) {
      // ignore
    }
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'Only .md files are allowed' },
    };
    return;
  }

  try {
    const markdownContent = await fs.readFile(file.path, 'utf-8');
    await fs.unlink(file.path);

    const editor = new Editor({
      extensions: [StarterKit, Markdown],
    });

    const tiptapJSON = editor.markdown.parse(markdownContent);

    ctx.body = {
      success: true,
      data: tiptapJSON,
    };
  } catch (error) {
    console.error(error);

    try {
      await fs.unlink(file.path);
    } catch (e) {
      // ignore
    }

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'convert error', details: error.message },
    };
  }
});

// JSON 方式
router.post('/md-convert/json', async (ctx) => {
  if (!global.document) {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
  }

  const { content } = ctx.request.body || {};

  if (!content) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'No content provided' },
    };
    return;
  }

  try {
    const editor = new Editor({
      extensions: [StarterKit, Markdown],
    });

    const tiptapJSON = editor.markdown.parse(content);

    ctx.body = {
      success: true,
      data: tiptapJSON,
    };
  } catch (error) {
    console.error(error);

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'convert error', details: error.message },
    };
  }
});

export default router;
