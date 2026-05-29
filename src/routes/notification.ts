import { Router, Request, Response, NextFunction } from 'express';
import NotificationController from '../controllers/others/notification';
import { protect } from '../middleware/auth';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';

const router = Router();

router.use(protect);

// GET /api/v1/notifications
router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user._id ?? (req as any).user.id;
        const { page, limit, type, unreadOnly } = req.query;

        const filter = { userId };

        const result = await NotificationController.getNotificationList(filter, 'user', {
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 20,
            type: type as string,
            unreadOnly: unreadOnly === 'true',
        });

        (res as AppResponse).data(result, 'Notifications retrieved successfully');
    })
);

// GET /api/v1/notifications/unread-count
router.get(
    '/unread-count',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user._id ?? (req as any).user.id;
        const result = await NotificationController.getUnreadCount(userId, 'user');
        (res as AppResponse).data(result, 'Unread count retrieved');
    })
);

// PATCH /api/v1/notifications/read-all
router.patch(
    '/read-all',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user._id ?? (req as any).user.id;
        await NotificationController.markAllAsRead(userId, 'user');
        (res as AppResponse).success('All notifications marked as read');
    })
);

// PATCH /api/v1/notifications/:id/read
router.patch(
    '/:id/read',
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = (req as any).user._id ?? (req as any).user.id;
        try {
            const result = await NotificationController.markAsRead(req.params.id, userId.toString());
            (res as AppResponse).data(result, 'Notification marked as read');
        } catch (err: any) {
            return next(new AppError(err.message || 'Notification not found', 404));
        }
    })
);

// POST /api/v1/notifications/:id/click
router.post(
    '/:id/click',
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = (req as any).user._id ?? (req as any).user.id;
        try {
            const result = await NotificationController.trackClick(req.params.id, userId.toString());
            (res as AppResponse).data(result, 'Click tracked');
        } catch (err: any) {
            return next(new AppError(err.message || 'Notification not found', 404));
        }
    })
);

// DELETE /api/v1/notifications/:id
router.delete(
    '/:id',
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = (req as any).user._id ?? (req as any).user.id;
        try {
            await NotificationController.deleteNotification(req.params.id, userId.toString());
            (res as AppResponse).success('Notification deleted');
        } catch (err: any) {
            return next(new AppError(err.message || 'Notification not found', 404));
        }
    })
);

export default router;
