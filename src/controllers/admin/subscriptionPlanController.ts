import { Request, Response, NextFunction } from 'express';
import SubscriptionPlan from '../../models/SubscriptionPlan';
import UserSubscription from '../../models/UserSubscription';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';

// @desc    Get all subscription plans
// @route   GET /api/v1/admin/subscription-plans
// @access  Private/Admin
export const getAllPlans = asyncHandler(async (req: Request, res: Response) => {
    const { isActive, page = 1, limit = 20 } = req.query;

    const query: any = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [plans, total] = await Promise.all([
        SubscriptionPlan.find(query)
            .sort({ price: 1 })
            .skip(skip)
            .limit(limitNum)
            .populate('createdBy', 'fullName email')
            .lean(),
        SubscriptionPlan.countDocuments(query)
    ]);

    // Attach active subscriber count per plan
    const plansWithStats = await Promise.all(
        plans.map(async (plan) => {
            const activeCount = await UserSubscription.countDocuments({
                planId: plan._id,
                status: 'active',
                endDate: { $gt: new Date() }
            });
            return { ...plan, activeSubscribers: activeCount };
        })
    );

    (res as AppResponse).data(
        {
            plans: plansWithStats,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        },
        'Subscription plans retrieved successfully'
    );
});

// @desc    Get single subscription plan
// @route   GET /api/v1/admin/subscription-plans/:id
// @access  Private/Admin
export const getPlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const plan = await SubscriptionPlan.findById(req.params.id)
        .populate('createdBy', 'fullName email')
        .populate('updatedBy', 'fullName email');

    if (!plan) return next(new AppError('Subscription plan not found', 404));

    const [activeCount, totalSubscribers] = await Promise.all([
        UserSubscription.countDocuments({ planId: plan._id, status: 'active', endDate: { $gt: new Date() } }),
        UserSubscription.countDocuments({ planId: plan._id, paymentStatus: 'completed' })
    ]);

    (res as AppResponse).data(
        { plan, stats: { activeSubscribers: activeCount, totalSubscribers } },
        'Subscription plan retrieved successfully'
    );
});

// @desc    Create subscription plan
// @route   POST /api/v1/admin/subscription-plans
// @access  Private/Admin
export const createPlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const {
        name, description, price, durationDays,
        discountPercentage, maxDiscountAmountPerOrder,
        features, badgeColor
    } = req.body;

    if (!name || !description || price === undefined || !durationDays || !discountPercentage) {
        return next(new AppError('name, description, price, durationDays, discountPercentage are required', 400));
    }

    const existing = await SubscriptionPlan.findOne({ name: name.trim() });
    if (existing) return next(new AppError('A plan with this name already exists', 409));

    const plan = await SubscriptionPlan.create({
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        durationDays: parseInt(durationDays),
        discountPercentage: parseFloat(discountPercentage),
        maxDiscountAmountPerOrder: maxDiscountAmountPerOrder ? parseFloat(maxDiscountAmountPerOrder) : undefined,
        features: features || [],
        badgeColor: badgeColor || 'gold',
        isActive: true,
        createdBy: req.user.id
    });

    (res as AppResponse).data({ plan }, 'Subscription plan created successfully', 201);
});

// @desc    Update subscription plan
// @route   PUT /api/v1/admin/subscription-plans/:id
// @access  Private/Admin
export const updatePlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return next(new AppError('Subscription plan not found', 404));

    // Check name uniqueness if changing
    if (req.body.name && req.body.name.trim() !== plan.name) {
        const existing = await SubscriptionPlan.findOne({
            name: req.body.name.trim(),
            _id: { $ne: plan._id }
        });
        if (existing) return next(new AppError('A plan with this name already exists', 409));
    }

    const allowedUpdates = [
        'name', 'description', 'price', 'durationDays',
        'discountPercentage', 'maxDiscountAmountPerOrder',
        'features', 'badgeColor', 'isActive'
    ];

    allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
            (plan as any)[field] = req.body[field];
        }
    });

    plan.updatedBy = req.user.id;
    await plan.save();

    (res as AppResponse).data({ plan }, 'Subscription plan updated successfully');
});

// @desc    Toggle plan active status
// @route   PATCH /api/v1/admin/subscription-plans/:id/toggle
// @access  Private/Admin
export const togglePlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return next(new AppError('Subscription plan not found', 404));

    plan.isActive = !plan.isActive;
    if (req.user) plan.updatedBy = req.user.id;
    await plan.save();

    (res as AppResponse).data(
        { plan },
        `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`
    );
});

// @desc    Delete subscription plan (only if no active subscribers)
// @route   DELETE /api/v1/admin/subscription-plans/:id
// @access  Private/Admin
export const deletePlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return next(new AppError('Subscription plan not found', 404));

    const activeCount = await UserSubscription.countDocuments({
        planId: plan._id,
        status: 'active',
        endDate: { $gt: new Date() }
    });

    if (activeCount > 0) {
        return next(
            new AppError(
                `Cannot delete plan. ${activeCount} user(s) currently have active subscriptions. Deactivate it instead.`,
                400
            )
        );
    }

    await plan.deleteOne();
    (res as AppResponse).success('Subscription plan deleted successfully');
});

// @desc    Get all user subscriptions (with filters)
// @route   GET /api/v1/admin/subscription-plans/subscriptions
// @access  Private/Admin
export const getAllSubscriptions = asyncHandler(async (req: Request, res: Response) => {
    const {
        status,
        planId,
        page = 1,
        limit = 20,
        search
    } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (planId) query.planId = planId;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // If search, look up by user name/phone
    let userIds: string[] | undefined;
    if (search) {
        const User = require('../../models/User').default;
        const users = await User.find({
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        }).select('_id');
        userIds = users.map((u: any) => u._id.toString());
        query.userId = { $in: userIds };
    }

    const [subscriptions, total] = await Promise.all([
        UserSubscription.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'name email phoneNumber avatar')
            .populate('planId', 'name discountPercentage durationDays badgeColor')
            .lean(),
        UserSubscription.countDocuments(query)
    ]);

    // Summary stats
    const [activeTotal, revenueResult] = await Promise.all([
        UserSubscription.countDocuments({ status: 'active', endDate: { $gt: new Date() } }),
        UserSubscription.aggregate([
            { $match: { paymentStatus: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amountPaid' } } }
        ])
    ]);

    (res as AppResponse).data(
        {
            subscriptions,
            stats: {
                activeSubscribers: activeTotal,
                totalRevenue: revenueResult[0]?.total || 0
            },
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        },
        'Subscriptions retrieved successfully'
    );
});