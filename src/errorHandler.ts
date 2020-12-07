import { Request, Response, NextFunction } from 'express';
import { OnError } from './validator';

export interface LoggableError {
  message: string;
  errors: string;
}

export interface LogFunction {
  (logError: LoggableError): void;
}

export interface ErrorHandlerOptions {
  log?: LogFunction;
}

export const create = (options?: ErrorHandlerOptions): OnError => {
  let log = options?.log;

  const errMapper = (err: Error) => {
    return {
      message: err.message,
      stack: err.stack,
    };
  };

  const errorHandler = (
    err: Error[],
    req: Request,
    res: Response,
    next?: NextFunction
  ): void => {
    let errorsForLog;
    let errors;

    if (err.length === 1) {
      errorsForLog = [errMapper(err[0])];
    } else {
      errorsForLog = err.map(errMapper);
    }
    errors = err.map((e) => e.message);

    if (log) {
      log({
        message: 'Unable to process request',
        errors: JSON.stringify(errorsForLog),
      });
    }

    res.status(400).json({
      message: 'Request validation error',
      errors,
    });
  };

  return errorHandler;
};
