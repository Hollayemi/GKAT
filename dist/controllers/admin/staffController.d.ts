import { Request, Response, NextFunction } from 'express';
export declare const getAllStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const getStaffById: (req: Request, res: Response, next: NextFunction) => void;
export declare const createStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const loginStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const updateStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const updateStaffRole: (req: Request, res: Response, next: NextFunction) => void;
export declare const deleteStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const suspendStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const unsuspendStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const disableStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const enableStaff: (req: Request, res: Response, next: NextFunction) => void;
export declare const resetPassword: (req: Request, res: Response, next: NextFunction) => void;
export declare const bulkSuspend: (req: Request, res: Response, next: NextFunction) => void;
export declare const bulkDelete: (req: Request, res: Response, next: NextFunction) => void;
export declare const getActivityLogs: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=staffController.d.ts.map