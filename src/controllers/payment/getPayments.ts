import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import productPurchaseLog from '../../models/billing/productPurchaseLog';
import { getOrdersPayment } from './pipeline';

interface AuthUser {
    branchId?: string;
    userId?: string;
    store?: string;
}

export const getOrderPayments = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
        const { branchId, userId, store } = req.user as AuthUser;
        let match: any = {};

        if (branchId) {
            match = {
                "orderInfo.store": store
            };
        }

        if (userId) {
            match = {
                userId: new Types.ObjectId(userId)
            };
        }

        const paymentLog = await productPurchaseLog.aggregate(getOrdersPayment(match));
        return res.status(200).json(paymentLog);
    } catch (error) {
        return next(error);
    }
};