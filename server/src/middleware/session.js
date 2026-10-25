import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const COOKIE = 'amr_session';
const hashToken = (token) => createHmac('sha256', env.sessionSecret || 'local-development-session-pepper').update(token).digest('hex');

export function issueSession(req, res) {
  const existing = req.cookies?.[COOKIE];
  if (existing && existing.length >= 40) return res.json({ success: true, data: { sessionReady: true } });
  const token = randomBytes(32).toString('base64url');
  res.cookie(COOKIE, token, {
    httpOnly: true, secure: env.nodeEnv === 'production', sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, path: '/',
  });
  res.json({ success: true, data: { sessionReady: true } });
}

export function requireSession(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token || token.length < 40) return next(new AppError(401, 'SESSION_REQUIRED', 'Your session is missing. Refresh the page and try again.'));
  req.ownerHash = hashToken(token);
  next();
}
