import dotenv from 'dotenv';

dotenv.config();

export default {
  port: process.env.PORT || 3001,
  env: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'dev_db',
    user: process.env.DB_USER || 'dev_user',
    password: process.env.DB_PASSWORD || 'dev_password',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};
