import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { captureError } from '../config/sentry.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('💥 [Server Error]:', err);

  // Report to Sentry APM
  captureError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
