import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    constructor(message: string, statusCode: number);
}
export interface AppResponse extends Response {
    data: (data: any, message?: string, status?: number) => Response;
    success: (message?: string, status?: number) => Response;
    error: (error: any, message?: string, code?: number) => Response;
    errorMessage: (message: string, status?: number) => Response;
}
export declare const extendResponse: (req: Request, res: Response, next: NextFunction) => void;
export declare const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
export declare const handle404: (req: Request, res: Response) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const jsonParseErrorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
declare const _default: {
    AppError: typeof AppError;
    extendResponse: (req: Request, res: Response, next: NextFunction) => void;
    errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
    handle404: (req: Request, res: Response) => void;
    asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
    jsonParseErrorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
};
export default _default;
//# sourceMappingURL=error.d.ts.map