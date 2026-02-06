import { Request, Response, NextFunction } from 'express';
import { IStaff } from '../models/admin/Staff.model';
import { IUser } from '../models/User';
declare global {
    namespace Express {
        interface Request {
            user?: IUser | IStaff & {
                permissions: string[];
            } | any;
        }
    }
}
export declare const ifToken: (req: Request, res: Response, next: NextFunction) => void;
export declare const protect: (req: Request, res: Response, next: NextFunction) => void;
export declare const checkPermission: (permission: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const checkPermissions: (...permissions: string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const checkAnyPermission: (...permissions: string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const authorize: (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const checkOwnerOrPermission: (permission: string) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map