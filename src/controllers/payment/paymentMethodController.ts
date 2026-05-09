import { Request, Response, NextFunction } from 'express';
import PaymentMethod from '../../models/PaymentMethod';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import PaymentMethodModel from '../../models/PaymentMethod';

export const getAllPaymentMethods = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const methods = await PaymentMethod.find().sort({ sortOrder: 1 });
        (res as AppResponse).data(methods, 'Payment methods retrieved');
    }
);

export const getEnabledPaymentMethods = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const methods = await PaymentMethod.find({ enabled: true }).sort({ sortOrder: 1 });
        (res as AppResponse).data({ paymentMethods: methods }, 'Payment methods retrieved');
    }
);

export const togglePaymentMethod = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const method = await PaymentMethod.findOne({ id: req.params.id });

        if (!method) {
            return next(new AppError('Payment method not found', 404));
        }

        method.enabled = !method.enabled;
        await method.save();

        (res as AppResponse).data(
            { paymentMethod: method },
            `Payment method ${method.enabled ? 'enabled' : 'disabled'} successfully`
        );
    }
);

export const updatePaymentMethod = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { name, description, logo, enabled, sortOrder } = req.body;

        const method = await PaymentMethod.findOneAndUpdate(
            { id: req.params.id },
            { name, description, logo, enabled, sortOrder },
            { new: true, runValidators: true }
        );

        if (!method) {
            return next(new AppError('Payment method not found', 404));
        }

        (res as AppResponse).data({ paymentMethod: method }, 'Payment method updated');
    }
);

export async function getSupportedPaymentMethods(): Promise<
    Array<{
        id: string;
        name: string;
        description: string;
        logo: string;
        enabled: boolean;
        sortOrder: number;
    }>
> {
    const methods = await PaymentMethodModel.find({ enabled: true }).sort({ sortOrder: 1 });
    return methods.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        logo: m.logo,
        enabled: m.enabled,
        sortOrder: m.sortOrder
    }));
}