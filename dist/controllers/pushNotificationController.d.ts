import { Request, Response, NextFunction } from 'express';
export declare const getAllNotifications: (req: Request, res: Response, next: NextFunction) => void;
export declare const getNotificationById: (req: Request, res: Response, next: NextFunction) => void;
export declare const createNotification: (req: Request, res: Response, next: NextFunction) => void;
export declare const updateNotification: (req: Request, res: Response, next: NextFunction) => void;
export declare const sendNotification: (req: Request, res: Response, next: NextFunction) => void;
export declare const testNotification: (req: Request, res: Response, next: NextFunction) => void;
export declare const estimateRecipients: (req: Request, res: Response, next: NextFunction) => void;
export declare const deleteNotification: (req: Request, res: Response, next: NextFunction) => void;
export declare const trackDelivered: (req: Request, res: Response, next: NextFunction) => void;
export declare const trackClicked: (req: Request, res: Response, next: NextFunction) => void;
export declare const getStatistics: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=pushNotificationController.d.ts.map