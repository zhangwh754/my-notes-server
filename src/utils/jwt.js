import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 检查环境变量是否配置
if (!SECRET_KEY) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

/**
 * 生成 JWT token
 * @param {Object} payload - 要编码的数据 (如 { userId, username })
 * @returns {string} JWT token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, SECRET_KEY, {
    expiresIn: EXPIRES_IN,
  });
};

/**
 * 验证 JWT token
 * @param {string} token - JWT token
 * @returns {Object} 解码后的 payload
 * @throws {Error} 如果 token 无效或过期
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * 解码 JWT token (不验证，仅用于查看内容)
 * @param {string} token - JWT token
 * @returns {Object} 解码后的 payload
 */
export const decodeToken = (token) => {
  return jwt.decode(token);
};
