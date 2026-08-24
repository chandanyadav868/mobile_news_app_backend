import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('💥 [Server Error]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
