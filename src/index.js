import Koa from 'koa';
import config from './config.js';
import { middleware, healthCheck } from './middleware/index.js';
import { applyRoutes } from './routes/index.js';

const app = new Koa();

// Apply middleware
app.use(middleware.cors);
app.use(middleware.bodyParser);
app.use(middleware.errorHandler);
app.use(middleware.responseFormatter);
app.use(healthCheck);

// Apply routes
applyRoutes(app);

// Start server
app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Environment: ${config.env}`);
});

export default app;
