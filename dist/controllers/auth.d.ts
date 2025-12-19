import { Request, Response, NextFunction } from 'express';
export declare const login: (req: Request, res: Response, next: NextFunction) => void;
export declare const verifyLoginOTP: (req: Request, res: Response, next: NextFunction) => void;
export declare const sendOTP: (req: Request, res: Response, next: NextFunction) => void;
export declare const verifyOTP: (req: Request, res: Response, next: NextFunction) => void;
export declare const resendOTP: (req: Request, res: Response, next: NextFunction) => void;
export declare const completeProfile: (req: Request, res: Response, next: NextFunction) => void;
export declare const updateNotificationSettings: (req: Request, res: Response, next: NextFunction) => void;
export declare const updateBiometricSettings: (req: Request, res: Response, next: NextFunction) => void;
export declare const getMe: (req: Request, res: Response, next: NextFunction) => void;
export declare const logout: (req: Request, res: Response, next: NextFunction) => void;
export declare const refreshToken: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map