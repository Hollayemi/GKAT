import { Request, Response, NextFunction } from 'express';
import Order from '../../models/Orders';
import Coupon from '../../models/Coupon';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import { logActivity } from '../../utils/activityLogger';
import { ACTIONS } from '../../models/admin/Activitylog.model';

export const getCoupons = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
        status,
        search,
        promoType,
        page = 1,
        limit = 20,
        sort = '-createdAt'
    } = req.query;

    const query: any = {};

    if (status && status !== 'all') {
        const now = new Date();
        if (status === 'running') {
            query.isActive = true;
            query.endDateTime = { $gt: now };
            query.startDateTime = { $lte: now };
        } else if (status === 'upcoming') {
            query.isActive = true;
            query.startDateTime = { $gt: now };
        } else if (status === 'ended') {
            query.endDateTime = { $lte: now };
        } else if (status === 'draft') {
            query.isActive = false;
        }
    }

    if (search) {
        query.$or = [
            { promotionName: { $regex: search, $options: 'i' } },
            { couponCode: { $regex: search, $options: 'i' } }
        ];
    }

    if (promoType) {
        query.promoType = promoType;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [coupons, total, stats] = await Promise.all([
        Coupon.find(query)
            .sort(sort as string)
            .skip(skip)
            .limit(limitNum)
            .populate('createdBy', 'name email')
            .select('-__v'),

        Coupon.countDocuments(query),

        Coupon.aggregate([
            {
                $facet: {
                    activePromotions: [
                        {
                            $match: {
                                isActive: true,
                                endDateTime: { $gt: new Date() },
                                startDateTime: { $lte: new Date() }
                            }
                        },
                        { $count: 'count' }
                    ],
                    upcomingPromotions: [
                        {
                            $match: {
                                isActive: true,
                                startDateTime: { $gt: new Date() }
                            }
                        },
                        { $count: 'count' }
                    ],
                    endedPromotions: [
                        {
                            $match: {
                                endDateTime: { $lte: new Date() }
                            }
                        },
                        { $count: 'count' }
                    ],
                    mostRedeemed: [
                        { $sort: { currentUsage: -1 } },
                        { $limit: 1 },
                        {
                            $project: {
                                promotionName: 1,
                                couponCode: 1,
                                currentUsage: 1
                            }
                        }
                    ],
                    totalOrders: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$currentUsage' }
                            }
                        }
                    ]
                }
            }
        ])
    ]);

    const formattedCoupons = coupons.map(coupon => {
        const now = new Date();
        let status = 'draft';

        if (coupon.isActive) {
            if (now >= coupon.startDateTime && now < coupon.endDateTime) {
                status = 'running';
            } else if (now < coupon.startDateTime) {
                status = 'upcoming';
            } else {
                status = 'ended';
            }
        }

        return {
            _id: coupon._id,
            promoName: coupon.promotionName,
            code: coupon.couponCode,
            discountType: coupon.promoType,
            value: coupon.discountValue,
            usageLimit: coupon.usageLimit,
            used: coupon.currentUsage,
            startDate: coupon.startDateTime,
            endDate: coupon.endDateTime,
            status,
            createdBy: coupon.createdBy
        };
    });

    (res as AppResponse).data(
        {
            coupons: formattedCoupons,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            },
            stats: {
                activePromotions: stats[0]?.activePromotions[0]?.count || 0,
                upcomingPromotions: stats[0]?.upcomingPromotions[0]?.count || 0,
                endedPromotions: stats[0]?.endedPromotions[0]?.count || 0,
                mostRedeemedPromo: stats[0]?.mostRedeemed[0]?.couponCode || 'N/A',
                totalOrdersWithDiscounts: stats[0]?.totalOrders[0]?.total || 0
            }
        },
        'Coupons retrieved successfully'
    );
});

export const getCoupon = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const coupon = await Coupon.findById(req.params.id)
        .populate('createdBy', 'name email');

    if (!coupon) {
        return next(new AppError('Coupon not found', 404));
    }

    (res as AppResponse).data({ coupon }, 'Coupon retrieved successfully');
});

export const createCoupon = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const {
        promotionName,
        promoType,
        couponCode,
        discountValue,
        usageLimit,
        perUserLimit,
        description,
        minimumOrderValue,
        applicableCategories,
        applicableProducts,
        startDateTime,
        endDateTime
    } = req.body;

    if (!promotionName) {
        return next(new AppError('Promotion name is required', 400));
    }
    if (!promoType) {
        return next(new AppError('Promo type is required', 400));
    }
    if (!couponCode) {
        return next(new AppError('Coupon code is required', 400));
    }
    if (!discountValue || discountValue <= 0) {
        return next(new AppError('Discount value must be greater than 0', 400));
    }
    if (!usageLimit || usageLimit <= 0) {
        return next(new AppError('Usage limit must be greater than 0', 400));
    }
    if (!perUserLimit || perUserLimit <= 0) {
        return next(new AppError('Per user limit must be greater than 0', 400));
    }
    if (!startDateTime) {
        return next(new AppError('Start date & time is required', 400));
    }
    if (!endDateTime) {
        return next(new AppError('End date & time is required', 400));
    }

    const existingCoupon = await Coupon.findOne({
        couponCode: couponCode.toUpperCase()
    });

    if (existingCoupon) {
        return next(new AppError('Coupon code already exists', 409));
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (end <= start) {
        return next(new AppError('End date must be after start date', 400));
    }

    if (promoType.toLowerCase().includes('percentage') ||
        promoType.toLowerCase().includes('%')) {
        if (discountValue < 0 || discountValue > 100) {
            return next(new AppError('Percentage discount must be between 0 and 100', 400));
        }
    }

    try {


        const coupon = await Coupon.create({
            promotionName,
            promoType: promoType.toLowerCase(),
            couponCode: couponCode.toUpperCase(),
            discountValue: parseFloat(discountValue),
            usageLimit: parseInt(usageLimit),
            perUserLimit: parseInt(perUserLimit),
            description,
            minimumOrderValue: minimumOrderValue ? parseFloat(minimumOrderValue) : 0,
            applicableCategories: applicableCategories || [],
            applicableProducts: applicableProducts || [],
            startDateTime: start,
            endDateTime: end,
            isActive: true,
            createdBy: req.user.id
        });

        await logActivity(req, {
            action: ACTIONS.COUPON_CREATED,
            description: `Created coupon "${couponCode.toUpperCase()}" (${promoType}) — ${discountValue}% off, valid ${startDateTime} → ${endDateTime}`,
            targetId: coupon._id.toString(),
            targetType: 'Coupon',
            targetName: couponCode.toUpperCase(),
            after: {
                couponCode: couponCode.toUpperCase(), promoType, discountValue,
                usageLimit, startDateTime, endDateTime,
            },
        });

        (res as AppResponse).data(
            { coupon },
            'Coupon created successfully',
            201
        );
    } catch (error) {
        console.log(error)
    }
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new AppError('Coupon not found', 404));
    }

    if (req.body.couponCode &&
        req.body.couponCode.toUpperCase() !== coupon.couponCode) {
        const existingCoupon = await Coupon.findOne({
            couponCode: req.body.couponCode.toUpperCase(),
            _id: { $ne: req.params.id }
        });

        if (existingCoupon) {
            return next(new AppError('Coupon code already exists', 409));
        }
        req.body.couponCode = req.body.couponCode.toUpperCase();
    }

    if (req.body.startDateTime && req.body.endDateTime) {
        const start = new Date(req.body.startDateTime);
        const end = new Date(req.body.endDateTime);

        if (end <= start) {
            return next(new AppError('End date must be after start date', 400));
        }
    }

    if (req.body.promoType && req.body.discountValue) {
        if (req.body.promoType.toLowerCase().includes('percentage') ||
            req.body.promoType.toLowerCase().includes('%')) {
            if (req.body.discountValue < 0 || req.body.discountValue > 100) {
                return next(new AppError('Percentage discount must be between 0 and 100', 400));
            }
        }
    }

    const before = {
        couponCode: coupon.couponCode, discountValue: coupon.discountValue,
        isActive: coupon.isActive, endDateTime: coupon.endDateTime,
    };

    coupon = await Coupon.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );
    await logActivity(req, {
        action: ACTIONS.COUPON_UPDATED,
        description: `Updated coupon "${coupon!.couponCode}"`,
        targetId: req.params.id,
        targetType: 'Coupon',
        targetName: coupon!.couponCode,
        before,
        after: req.body,
    });


    (res as AppResponse).data({ coupon }, 'Coupon updated successfully');
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new AppError('Coupon not found', 404));
    }

    const Order = require('../models/Orders').default;
    const activeOrders = await Order.countDocuments({
        'appliedCoupons.code': coupon.couponCode,
        orderStatus: { $in: ['pending', 'confirmed', 'processing', 'shipped'] }
    });

    if (activeOrders > 0) {
        return next(new AppError(
            `Cannot delete coupon. It is currently applied to ${activeOrders} active order(s). Consider disabling it instead.`,
            400
        ));
    }

    await coupon.deleteOne();

    await logActivity(req, {
        action: ACTIONS.COUPON_DELETED,
        description: `Deleted coupon "${coupon.couponCode}"`,
        targetId: req.params.id,
        targetType: 'Coupon',
        targetName: coupon.couponCode,
        before: { couponCode: coupon.couponCode, discountValue: coupon.discountValue },
    });

    (res as AppResponse).success('Coupon deleted successfully');
});

export const toggleCouponStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new AppError('Coupon not found', 404));
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    await logActivity(req, {
        action: ACTIONS.COUPON_STATUS_TOGGLED,
        description: `${coupon.isActive ? 'Enabled' : 'Disabled'} coupon "${coupon.couponCode}"`,
        targetId: coupon._id.toString(),
        targetType: 'Coupon',
        targetName: coupon.couponCode,
        metadata: { isActive: coupon.isActive },
    });

    (res as AppResponse).data(
        { coupon },
        `Coupon ${coupon.isActive ? 'enabled' : 'disabled'} successfully`
    );
});

export const changeCouponStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { status } = req.body;

    if (!status || !['active', 'draft'].includes(status)) {
        return next(new AppError('Valid status is required (active or draft)', 400));
    }

    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new AppError('Coupon not found', 404));
    }

    coupon.isActive = status === 'active';
    await coupon.save();

    (res as AppResponse).data(
        { coupon },
        `Coupon status changed to ${status} successfully`
    );
});

export const bulkUpdateCoupons = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { couponIds, updates } = req.body;

    if (!couponIds || !Array.isArray(couponIds) || couponIds.length === 0) {
        return next(new AppError('Please provide coupon IDs', 400));
    }

    if (!updates || typeof updates !== 'object') {
        return next(new AppError('Please provide updates', 400));
    }

    const result = await Coupon.updateMany(
        { _id: { $in: couponIds } },
        { $set: updates }
    );

    (res as AppResponse).data(
        {
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        },
        'Coupons updated successfully'
    );
});


export const getPromotionStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const now = new Date();

    // Calculate date ranges for comparison
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Helper function to calculate percentage change
    const calculatePercentageChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return parseFloat(((current - previous) / previous * 100).toFixed(1));
    };

    // Get current month stats
    const [
        currentActivePromotions,
        previousActivePromotions,
        currentUpcomingPromotions,
        previousUpcomingPromotions,
        currentEndedPromotions,
        previousEndedPromotions,
        mostRedeemedCoupon,
        currentTotalOrdersWithDiscounts,
        previousTotalOrdersWithDiscounts
    ] = await Promise.all([
        // Current Active Promotions (running now)
        Coupon.countDocuments({
            isActive: true,
            startDateTime: { $lte: now },
            endDateTime: { $gt: now }
        }),

        // Previous Month Active Promotions
        Coupon.countDocuments({
            isActive: true,
            startDateTime: { $lte: previousMonthEnd },
            endDateTime: { $gt: previousMonthStart }
        }),

        // Current Upcoming Promotions
        Coupon.countDocuments({
            isActive: true,
            startDateTime: { $gt: now }
        }),

        // Previous Month Upcoming Promotions (that started after previous month start)
        Coupon.countDocuments({
            isActive: true,
            startDateTime: { $gt: previousMonthStart, $lte: previousMonthEnd }
        }),

        // Current Ended Promotions
        Coupon.countDocuments({
            endDateTime: { $lte: now }
        }),

        // Previous Month Ended Promotions
        Coupon.countDocuments({
            endDateTime: { $gt: previousMonthStart, $lte: previousMonthEnd }
        }),

        // Most Redeemed Promo (all time)
        Coupon.findOne({ isActive: true })
            .sort({ currentUsage: -1 })
            .select('couponCode promotionName currentUsage'),

        // Current Month Total Orders with Discounts
        Order.countDocuments({
            createdAt: { $gte: currentMonthStart, $lte: now },
            'appliedCoupons.0': { $exists: true }
        }),

        // Previous Month Total Orders with Discounts
        Order.countDocuments({
            createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
            'appliedCoupons.0': { $exists: true }
        })
    ]);

    // Get redemption trend for most redeemed promo
    let mostRedeemedTrend = 0;
    if (mostRedeemedCoupon) {
        const [currentMonthRedemptions, previousMonthRedemptions] = await Promise.all([
            Order.countDocuments({
                createdAt: { $gte: currentMonthStart, $lte: now },
                'appliedCoupons.code': mostRedeemedCoupon.couponCode
            }),
            Order.countDocuments({
                createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
                'appliedCoupons.code': mostRedeemedCoupon.couponCode
            })
        ]);
        mostRedeemedTrend = calculatePercentageChange(currentMonthRedemptions, previousMonthRedemptions);
    }

    const stats = {
        activePromotions: {
            count: currentActivePromotions,
            change: calculatePercentageChange(currentActivePromotions, previousActivePromotions)
        },
        upcomingPromotions: {
            count: currentUpcomingPromotions,
            change: calculatePercentageChange(currentUpcomingPromotions, previousUpcomingPromotions)
        },
        endedPromotions: {
            count: currentEndedPromotions,
            change: calculatePercentageChange(currentEndedPromotions, previousEndedPromotions)
        },
        mostRedeemedPromo: {
            code: mostRedeemedCoupon?.couponCode || 'N/A',
            name: mostRedeemedCoupon?.promotionName || 'N/A',
            redemptionCount: mostRedeemedCoupon?.currentUsage || 0,
            change: mostRedeemedTrend
        },
        totalOrdersWithDiscounts: {
            count: currentTotalOrdersWithDiscounts,
            change: calculatePercentageChange(currentTotalOrdersWithDiscounts, previousTotalOrdersWithDiscounts)
        }
    };

    (res as AppResponse).data(stats, 'Promotion stats retrieved successfully');
});
