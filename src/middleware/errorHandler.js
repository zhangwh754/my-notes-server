export const errorHandler = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('Error caught by error handler:', err);

    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      error: {
        message: err.message || 'Internal Server Error',
        code: err.code || 'INTERNAL_ERROR',
      },
    };

    // Don't expose stack trace in production
    if (process.env.NODE_ENV === 'development') {
      ctx.body.error.stack = err.stack;
    }

    ctx.app.emit('error', err, ctx);
  }
};

export const notFoundHandler = async (ctx) => {
  ctx.status = 404;
  ctx.body = {
    success: false,
    error: {
      message: 'Not Found',
      code: 'NOT_FOUND',
    },
  };
};
