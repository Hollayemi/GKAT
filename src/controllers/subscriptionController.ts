import { Request, Response, NextFunction } from 'express';
import SubscriptionPlan from '../models/SubscriptionPlan';
import UserSubscription from '../models/UserSubscription';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';
import PaymentGateway from '../services/payment';

// @desc    Get all active subscription plans (public)
// @route   GET /api/v1/subscriptions/plans
// @access  Public
export const getActivePlans = asyncHandler(async (req: Request, res: Response) => {
    const plans = await SubscriptionPlan.find({ isActive: true })
        .sort({ price: 1 })
        .select('-createdBy -updatedBy')
        .lean();

    (res as AppResponse).data({ plans }, 'Subscription plans retrieved successfully');
});

// @desc    Get current user's active subscription
// @route   GET /api/v1/subscriptions/my-subscription
// @access  Private
export const getMySubscription = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const subscription = await UserSubscription.getActiveSubscription(req.user.id);

    if (!subscription) {
        return (res as AppResponse).data({ subscription: null }, 'No active subscription found');
    }

    (res as AppResponse).data({ subscription }, 'Active subscription retrieved successfully');
});

// @desc    Get user's subscription history
// @route   GET /api/v1/subscriptions/history
// @access  Private
export const getSubscriptionHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [subscriptions, total] = await Promise.all([
        UserSubscription.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('planId', 'name discountPercentage durationDays badgeColor')
            .lean(),
        UserSubscription.countDocuments({ userId: req.user.id })
    ]);

    (res as AppResponse).data(
        {
            subscriptions,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        },
        'Subscription history retrieved successfully'
    );
});

// @desc    Subscribe to a plan (initialises payment)
// @route   POST /api/v1/subscriptions/subscribe
// @access  Private
export const subscribeToPlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { planId, paymentMethod = 'paystack' } = req.body;

    if (!planId) return next(new AppError('planId is required', 400));

    // Check plan exists and is active
    const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
    if (!plan) return next(new AppError('Subscription plan not found or inactive', 404));

    // Check if user already has an active subscription to this plan
    const existing = await UserSubscription.findOne({
        userId: req.user.id,
        planId,
        status: 'active',
        endDate: { $gt: new Date() }
    });

    if (existing) {
        return next(
            new AppError(
                `You already have an active "${plan.name}" subscription that expires on ${existing.endDate?.toDateString()}`,
                400
            )
        );
    }

    // Generate payment reference
    const paymentGateway = new PaymentGateway();
    const paymentReference = `PAY_SUB_${req.user.id}_${Date.now()}`;

    // Create pending subscription record first
    const subscription = await UserSubscription.create({
        userId: req.user.id,
        planId: plan._id,
        paymentReference,
        paymentStatus: 'pending',
        amountPaid: plan.price,
        paymentMethod,
        status: 'pending_payment',
        planSnapshot: {
            name: plan.name,
            discountPercentage: plan.discountPercentage,
            maxDiscountAmountPerOrder: plan.maxDiscountAmountPerOrder,
            durationDays: plan.durationDays
        }
    });

    // Initialise payment
    const paymentData = {
        email: req.user.email || `user_${req.user.id}@gokart.ng`,
        amount: plan.price,
        reference: paymentReference,
        orderId: subscription._id.toString(),
        userId: req.user.id,
        description: `Go Prime - ${plan.name} (${plan.durationDays} days)`,
        phone: req.user.phone || req.user.phoneNumber || '',
        metadata: {
            type: 'subscription',
            subscriptionId: subscription._id.toString(),
            planId: plan._id.toString(),
            userId: req.user.id,
            planName: plan.name
        }
    };

    const paymentResult = await paymentGateway.initializePayment(paymentMethod, paymentData);

    if (!paymentResult.success) {
        // Clean up the pending record if payment init failed
        await subscription.deleteOne();
        return next(new AppError(paymentResult.error || 'Payment initialization failed', 400));
    }

    (res as AppResponse).data(
        {
            subscription: {
                _id: subscription._id,
                planName: plan.name,
                discountPercentage: plan.discountPercentage,
                durationDays: plan.durationDays,
                amountPaid: plan.price,
                status: subscription.status
            },
            payment: paymentResult.data
        },
        'Subscription initiated. Complete payment to activate.',
        201
    );
});

// @desc    Cancel active subscription
// @route   POST /api/v1/subscriptions/cancel
// @access  Private
export const cancelSubscription = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { reason } = req.body;

    const subscription = await UserSubscription.findOne({
        userId: req.user.id,
        status: 'active',
        endDate: { $gt: new Date() }
    });

    if (!subscription) return next(new AppError('No active subscription found', 404));

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason || 'User requested cancellation';
    await subscription.save();

    (res as AppResponse).data(
        { subscription },
        'Subscription cancelled. Your benefits remain active until the current period ends.'
    );
});

// @desc    Verify subscription payment manually (fallback)
// @route   POST /api/v1/subscriptions/verify-payment
// @access  Private
export const verifySubscriptionPayment = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { reference, provider = 'paystack' } = req.body;

    if (!reference) return next(new AppError('Payment reference is required', 400));

    const subscription = await UserSubscription.findOne({
        userId: req.user.id,
        paymentReference: reference
    }).populate('planId');

    if (!subscription) return next(new AppError('Subscription record not found for this reference', 404));

    if (subscription.paymentStatus === 'completed') {
        return (res as AppResponse).data({ subscription }, 'Subscription is already active');
    }

    const paymentGateway = new PaymentGateway();
    const result = await paymentGateway.verifyPayment(provider, reference);

    if (!result.success) {
        return next(new AppError(result.error || 'Payment verification failed', 400));
    }

    // Activate subscription
    const plan = subscription.planSnapshot;
    const now = new Date();
    const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    subscription.paymentStatus = 'completed';
    subscription.paymentCompletedAt = now;
    subscription.status = 'active';
    subscription.startDate = now;
    subscription.endDate = endDate;
    await subscription.save();

    (res as AppResponse).data(
        { subscription },
        `Go Prime activated! Your ${plan.name} subscription is valid until ${endDate.toDateString()}.`
    );
});