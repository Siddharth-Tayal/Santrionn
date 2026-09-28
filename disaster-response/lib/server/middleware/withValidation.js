'use strict';

const AppError = require('../utils/AppError');

/** Strip $ and . from user object keys before Mongoose sees them. */
function sanitizeInput(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeInput(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('$') || k.includes('.')) continue;
    out[k] = sanitizeInput(v, depth + 1);
  }
  return out;
}

function formatIssue(issue) {
  return {
    field: issue.path.length ? issue.path.join('.') : '(root)',
    issue: issue.code,
    message: issue.message,
  };
}

function validate(schema, value, label) {
  if (!schema) return value;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw AppError.validation(`Invalid request ${label}`, result.error.issues.map(formatIssue));
  }
  return result.data;
}

/**
 * Wrap a handler with param/query/body Zod schemas. Returned `body`, `query`,
 * `params` on the context are the parsed shapes.
 */
function withValidation({ body: bodySchema, query: querySchema, params: paramsSchema } = {}) {
  return (handler) => async (ctx) => {
    const params = validate(paramsSchema, ctx.params, 'path parameters');
    const query = validate(querySchema, ctx.query, 'query string');
    const body = validate(bodySchema, sanitizeInput(ctx.body), 'body');
    return handler({ ...ctx, params, query, body });
  };
}

module.exports = { withValidation, sanitizeInput };
