'use strict';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function parsePagination({ page, limit } = {}) {
  const p = Math.max(1, Number.isFinite(+page) ? Math.trunc(+page) : 1);
  const l = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(+limit) ? Math.trunc(+limit) : DEFAULT_LIMIT));
  return { page: p, limit: l, skip: (p - 1) * l };
}

function buildMeta({ total, limit, page }, extras = {}) {
  return {
    total: Number(total) || 0,
    limit,
    page,
    pages: Math.max(1, Math.ceil((Number(total) || 0) / limit)),
    ...extras,
  };
}

module.exports = { parsePagination, buildMeta, MAX_LIMIT, DEFAULT_LIMIT };
