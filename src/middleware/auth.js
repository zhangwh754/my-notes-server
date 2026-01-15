import { verifyToken } from '../utils/jwt.js';
import { query } from '../config/database.js';

/**
 * JWT 认证中间件
 * 从 Authorization header 中提取并验证 token
 * 将用户信息附加到 ctx.state.user
 *
 * 使用方式:
 * - router.get('/protected', auth, handler)
 */
export const auth = async (ctx, next) => {
  // 从 header 获取 token
  const authHeader = ctx.headers.authorization;

  if (!authHeader) {
    ctx.status = 401;
    ctx.body = {
      success: false,
      error: { message: 'Authorization header is required' },
    };
    return;
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    // 验证 token
    const decoded = verifyToken(token);

    // 将用户信息附加到 ctx.state
    ctx.state.user = {
      userId: decoded.userId,
      username: decoded.username,
    };

    await next();
  } catch (error) {
    ctx.status = 401;
    ctx.body = {
      success: false,
      error: { message: error.message || 'Authentication failed' },
    };
  }
};

/**
 * 资源所有权检查中间件
 * 验证当前登录用户是否拥有指定资源的所有权
 *
 * @param {string} tableName - 表名 (notes, note_types, tags)
 * @param {string} idParam - 路由参数中资源ID的名称，默认 'id'
 *
 * 使用方式:
 * - router.get('/notes/:id', auth, checkOwnership('notes'), handler)
 * - router.delete('/note-types/:typeId', auth, checkOwnership('note_types', 'typeId'), handler)
 */
export const checkOwnership = (tableName, idParam = 'id') => {
  return async (ctx, next) => {
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        error: { message: 'Authentication required' },
      };
      return;
    }

    const resourceId = ctx.params[idParam];
    const currentUserId = ctx.state.user.userId;

    try {
      // 从数据库查询资源的 owner_id
      const result = await query(`SELECT user_id FROM ${tableName} WHERE id = $1`, [resourceId]);

      if (result.rows.length === 0) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: { message: 'Resource not found' },
        };
        return;
      }

      const resourceOwnerId = result.rows[0].user_id;

      // 检查资源所有者是否为当前用户
      if (resourceOwnerId !== currentUserId) {
        ctx.status = 403;
        ctx.body = {
          success: false,
          error: { message: 'You do not have permission to access this resource' },
        };
        return;
      }

      await next();
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: { message: 'Failed to verify resource ownership' },
      };
    }
  };
};
