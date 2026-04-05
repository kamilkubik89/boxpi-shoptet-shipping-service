import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../lib/logger';
import { HttpError } from './http-error';

export function notFoundMiddleware(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(422).json({ error: 'Validation failed', details: error.flatten() });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message, details: error.details ?? null });
    return;
  }

  logger.error({ error }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}
