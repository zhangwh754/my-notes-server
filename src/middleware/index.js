import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { errorHandler } from './errorHandler.js';
import { responseFormatter } from './responseFormatter.js';

export const middleware = {
  // CORS
  cors: cors(),

  // Body parser
  bodyParser: bodyParser({
    enableTypes: ['json', 'form'],
    jsonLimit: '10mb',
    formLimit: '10mb',
    textLimit: '10mb',
  }),

  // Error handling
  errorHandler,

  // Response formatting
  responseFormatter,
};

// Health check middleware
export const healthCheck = async (ctx, next) => {
  if (ctx.path === '/health') {
    ctx.body = { status: 'ok', timestamp: new Date().toISOString() };
    return;
  }
  await next();
};
