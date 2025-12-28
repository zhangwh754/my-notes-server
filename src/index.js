import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from 'koa-cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import noteTypeRoutes from './routes/noteTypes.js';
// import noteRoutes from './routes/notes.js';
// import tagRoutes from './routes/tags.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = new Koa();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser({
  enableTypes: ['json', 'form'],
  jsonLimit: '10mb',
  formLimit: '10mb',
  textLimit: '10mb',
}));

// Error handling
app.use(errorHandler);

// Health check
app.use(async (ctx, next) => {
  if (ctx.path === '/health') {
    ctx.body = { status: 'ok', timestamp: new Date().toISOString() };
    return;
  }
  await next();
});

// Routes
app.use(authRoutes.routes());
app.use(authRoutes.allowedMethods());

app.use(noteTypeRoutes.routes());
app.use(noteTypeRoutes.allowedMethods());

// app.use(noteRoutes.routes());
// app.use(noteRoutes.allowedMethods());

// app.use(tagRoutes.routes());
// app.use(tagRoutes.allowedMethods());

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
