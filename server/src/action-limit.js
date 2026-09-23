import { rateLimit } from 'express-rate-limit'

// Zero keeps this future policy disabled without removing the middleware boundary.
export const NOTIFICATION_LIMIT = Number(process.env.NOTIFICATION_LIMIT || 0)
export const notificationLimit = NOTIFICATION_LIMIT > 0
  ? rateLimit({ windowMs: 60 * 60 * 1000, limit: NOTIFICATION_LIMIT, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Notification limit reached. Try again later.' } })
  : (_req, _res, next) => next()
