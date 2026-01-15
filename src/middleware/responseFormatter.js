/**
 * Convert snake_case string to camelCase
 */
const toCamelCase = (str) => {
  if (typeof str !== "string") return str;
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * Recursively convert all keys in an object from snake_case to camelCase
 */
const convertKeysToCamelCase = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }

  // 只处理纯对象
  if (typeof obj === "object" && obj.constructor === Object) {
    const converted = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = toCamelCase(key);
        converted[camelKey] = convertKeysToCamelCase(obj[key]);
      }
    }
    return converted;
  }

  return obj;
};
/**
 * Middleware to format response body with camelCase keys
 */
export const responseFormatter = async (ctx, next) => {
  await next();

  // Only transform if there's a body and it's an object or array
  if (ctx.body && typeof ctx.body === "object") {
    ctx.body = convertKeysToCamelCase(ctx.body);
  }
};
