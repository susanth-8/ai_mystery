export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function notFound(_req, _res, next) { next(new AppError(404, 'NOT_FOUND', 'This page or resource could not be found.')); }

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  const status = error.status || 500;
  if (status >= 500) console.error(`[api] ${error.code || 'INTERNAL_ERROR'}: ${error.message}`);
  res.status(status).json({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: status >= 500 && !error.code ? 'Something went wrong. Please try again.' : error.message } });
}
