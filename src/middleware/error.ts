import { Request, Response, NextFunction } from 'express';

// Custom error interface
interface CustomError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  response?: {
    status?: number;
    data?: any;
  };
}

// Extended Response interface with custom methods
export interface AppResponse extends Response {
  data: (data: any, message?: string) => AppResponse;
  success: (message?: string) => AppResponse;
  error: (error: any, message?: string, code?: number) => AppResponse;
  errorMessage: (message?: string, style?: object, code?: number) => AppResponse;
}

// Custom response methods
const customExpress = {
  data: function(this: AppResponse, data: any, message: string = 'success'): AppResponse {
    return this.type('json').json({
      type: 'success',
      data,
      message,
    }) as AppResponse;
  },

  success: function(this: AppResponse, message: string = 'success'): AppResponse {
    return this.type('json').json({
      type: 'success',
      message,
    }) as AppResponse;
  },

  error: function(this: AppResponse, error: any, message: string = 'An error occurred', code?: number): AppResponse {
    return this.status(code || 500).json({
      message,
      statusCode: -3,
      type: 'error',
      error,
    }) as AppResponse;
  },

  errorMessage: function(this: AppResponse, message: string = 'API response message', style: object = {}, code?: number): AppResponse {
    return this.status(code || 400).json({
      message,
      ...style,
      statusCode: 1,
      type: 'error',
    }) as AppResponse;
  },
};

// Apply custom methods to response prototype
export const extendResponse = (req: Request, res: Response, next: NextFunction) => {
  (res as AppResponse).data = customExpress.data;
  (res as AppResponse).success = customExpress.success;
  (res as AppResponse).error = customExpress.error;
  (res as AppResponse).errorMessage = customExpress.errorMessage;
  next();
};

// Main error handler
export const errorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction): void => {
  try {
    if (process.env.NODE_ENV === 'production') {
      if (err.status === 412) {
        (res as AppResponse).errorMessage(err.message, {}, err.status);
        return;
      }
      (res as AppResponse).errorMessage('An error occurred', {}, err.status || 400);
      return;
    }

    // Development mode - show detailed errors
    (res as AppResponse).error(err, err.message, err.status || 400);
  } catch (error) {
    const fallbackError = error as CustomError;
    (res as AppResponse).errorMessage(fallbackError.message, {}, fallbackError.status || 400);
  }
};

// Not found route handler
export const handle404 = (req: Request, res: Response): void => {
  (res as AppResponse).errorMessage('Route not found', {}, 404);
};

// JSON payload error handler
export const jsonPayload = (err: any, req: Request, res: Response): void => {
  if (err.type && err.type === 'entity.parse.failed') {
    (res as AppResponse).errorMessage('Invalid JSON payload passed.');
    return;
  }

  // Log error (you can integrate your logger here)
  console.error('JSON Parse Error:', {
    url: req.originalUrl,
    error: err.response?.data || err.toString(),
    stack: err.stack
  });

  const statusCode = err.response?.status || 500;
  (res as AppResponse).errorMessage(
    'Internal Server Error',
    {
      description: `Something broke! Check application logs for helpful tips. OriginalUrl: ${req.originalUrl}`,
    },
    statusCode
  );
};

export default errorHandler;