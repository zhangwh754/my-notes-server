// 安装依赖：
import { JSDOM } from 'jsdom';
import StarterKit from '@tiptap/starter-kit';
import Router from 'koa-router';
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';

const router = new Router({
  prefix: '/api/utils',
});

router.post('/md-convert', async (ctx) => {
  if (!global.document) {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
  }

  // 测试
  const markdownContent = `
    # 标题
    这是 **加粗** 的文字，下面是一个列表：
    - 项目 1
    - 项目 2
  `;

  try {
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

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'convert error', details: error.message },
    };
  }
});

export default router;
