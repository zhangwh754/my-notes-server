import Router from 'koa-router';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

const router = new Router({
  prefix: '/api/auth',
});

// Register
router.post('/register', async (ctx) => {
  const { username, email, password } = ctx.request.body;

  if (!username || !email || !password) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'Username, email and password are required' },
    };
    return;
  }

  try {
    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [
      username,
      email,
    ]);

    if (existingUser.rows.length > 0) {
      ctx.status = 409;
      ctx.body = {
        success: false,
        error: { message: 'Username or email already exists' },
      };
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    ctx.status = 201;
    ctx.body = {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.created_at,
        },
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to create user', details: error.message },
    };
  }
});

// Login
router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body;

  if (!username || !password) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'Username and password are required' },
    };
    return;
  }

  try {
    // Find user
    const result = await query(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        error: { message: 'Invalid credentials' },
      };
      return;
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        error: { message: 'Invalid credentials' },
      };
      return;
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    ctx.body = {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Login failed', details: error.message },
    };
  }
});

export default router;
