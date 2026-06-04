import { Request, Response, NextFunction } from 'express';
import Order, { OrderStatus } from '../../models/Orders';
import User from '../../models/User';
import Region from '../../models/config/region.model';
import StaffModel, { IStaff } from '../../models/admin/Staff.model';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import { dispatchOrderToDrivers } from "../rider/orders";
import mongoose from 'mongoose';
import NotificationController from '../others/notification';
import { logActivity } from '../../utils/activityLogger';
import { ACTIONS } from '../../models/admin/Activitylog.model';

function buildOrderStatusFilter(status: string): OrderStatus | null {
    const map: Record<string, OrderStatus> = {
        pending: 'pending',
        confirmed: 'confirmed',
        processing: 'processing',
        ready: 'ready',
        shipped: 'shipped',
        delivered: 'delivered',
        cancelled: 'cancelled',
        returned: 'returned',
        refunded: 'refunded',
    };
    return map[status.toLowerCase()] ?? null;
}

function formatDate(date: Date | string | null | undefined) {
    if (!date) return '-';
    const d = new Date(date);
    const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${datePart} - ${timePart}`;
}

async function formatOrder(order: any) {
    return {
        orderId: order.orderNumber,
        customerName: order.userId?.name || '',
        customerEmail: order.userId?.email || '',
        customerPhone: order.userId?.phoneNumber || '',
        deliveryAddress: order.shippingAddress?.address || '',
        totalAmount: order.totalAmount,
        items: order.items.length,
        status: order.orderStatus,
        region: order.region?.name || '-',
        dateOrdered: formatDate(order.createdAt),
        deliveryDate: formatDate(order.actualDelivery),
        courierName: order.carrier || '-',
        orderedItems: order.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image: item.image,
        })),
        activityTimeline: order.statusHistory.map((s: any) => ({
            time: s.timestamp,
            event: s.status,
        })),
    };
}

/**
 * Determine the region ObjectId for a staff member from their stored region
 * value (which may be a region name string or an ObjectId string).
 * Returns null for super_admin or when the staff has no region assigned.
 */
async function resolveStaffRegionId(
    staff: any
): Promise<mongoose.Types.ObjectId | null> {
    console.log(staff)
    const roleName: string = staff.role?.name ?? '';

    // if (roleName === 'super_admin') return null;

    const regionValue: string | undefined = staff.region;
    if (!regionValue) return null;

    if (mongoose.Types.ObjectId.isValid(regionValue)) {
        return new mongoose.Types.ObjectId(regionValue);
    }

    const region = await Region.findOne({ name: { $regex: new RegExp(`^${regionValue}$`, 'i') } }).lean();
    return region ? (region._id as mongoose.Types.ObjectId) : null;
}


export const getAllOrders = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const {
            page = 1,
            limit = 9,
            status = 'all',
            search = '',
            startDate,
            endDate,
            minAmount,
            maxAmount,
            region: regionFilter,
        } = req.query;

        const query: any = {};

        if (status !== 'all') {
            const mapped = buildOrderStatusFilter(status as string);
            if (!mapped) return next(new AppError('Invalid status value', 400));
            query.orderStatus = mapped;
        }

        const staffRegionId = await resolveStaffRegionId(req.user);

        // if (staffRegionId) {
        //     query.region = staffRegionId;
        // } else if (regionFilter) {
        //     if (!mongoose.Types.ObjectId.isValid(regionFilter as string)) {
        //         return next(new AppError('Invalid regionId filter', 400));
        //     }
        //     query.region = new mongoose.Types.ObjectId(regionFilter as string);
        // }

        if (minAmount || maxAmount) {
            query.totalAmount = {};
            if (minAmount) query.totalAmount.$gte = Number(minAmount);
            if (maxAmount) query.totalAmount.$lte = Number(maxAmount);
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate as string);
            if (endDate) query.createdAt.$lte = new Date(endDate as string);
        }

        if ((search as string).trim()) {
            const s = (search as string).trim();
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: s, $options: 'i' } },
                    { email: { $regex: s, $options: 'i' } }
                ]
            }).select('_id');

            const userIds = matchingUsers.map(u => u._id);
            query.$or = [
                { orderNumber: { $regex: s, $options: 'i' } },
                { userId: { $in: userIds } }
            ];
        }

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('userId', 'name email phoneNumber')
                .populate('shippingAddress')
                .populate('region', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Order.countDocuments(query),
        ]);

        const formattedOrders = await Promise.all(orders.map(formatOrder));

        const statsQuery = staffRegionId ? { region: staffRegionId } : {};
        const statsRaw = await Order.aggregate([
            { $match: statsQuery },
            { $group: { _id: '$orderStatus', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } }
        ]);

        const statMap = statsRaw.reduce<Record<string, { count: number; totalAmount: number }>>((acc, s) => {
            acc[s._id] = { count: s.count, totalAmount: s.totalAmount };
            return acc;
        }, {});

        const totalOrders = statsRaw.reduce((sum, s) => sum + s.count, 0);
        const revenue = statMap['delivered']?.totalAmount ?? 0;

        const stats = [
            { label: 'Total Orders', value: String(totalOrders), color: 'purple' },
            { label: 'Processing', value: String(statMap['processing']?.count ?? 0), color: 'orange' },
            { label: 'Delivered', value: String(statMap['delivered']?.count ?? 0), color: 'green' },
            { label: 'Cancelled', value: String(statMap['cancelled']?.count ?? 0), color: 'red' },
            { label: 'Revenue', value: `₦${revenue.toLocaleString()}`, color: 'blue' },
        ];

        (res as AppResponse).data(
            {
                orders: formattedOrders,
                stats,
                pagination: {
                    total,
                    totalPages: Math.ceil(total / limitNum),
                    currentPage: pageNum,
                    limit: limitNum,
                },
                scopedToRegion: staffRegionId ? staffRegionId.toString() : null,
            },
            'Orders retrieved successfully',
        );
    },
);

export const getOrderById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { orderNumber } = req.params;

        const staffRegionId = await resolveStaffRegionId(req.user);

        const filterQuery: any = { orderNumber };
        if (staffRegionId) {
            filterQuery.region = staffRegionId;
        }

        const order = await Order.findOne(filterQuery)
            .populate('userId', 'name email phoneNumber')
            .populate('shippingAddress')
            .populate('region', 'name coordinate')
            .lean();

        if (!order) {
            return next(new AppError('Order not found or not in your region', 404));
        }

        const formattedOrder = await formatOrder(order);

        (res as AppResponse).data({ order: formattedOrder }, 'Order retrieved successfully');
    },
);

export const cancelOrder = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return next(new AppError('Not authenticated', 401));

        const { orderNumber } = req.params;
        const { reason, note, password } = req.body;

        if (!reason || !note || !password) {
            return next(new AppError('reason, note, and password are required', 400));
        }

        const admin = (await StaffModel.findById(req.user.id).select('+password')) as
            | (IStaff & { comparePassword?: (p: string) => Promise<boolean> })
            | null;

        if (!admin) return next(new AppError('Admin not found', 404));

        const isMatch = admin.comparePassword(password);
        if (!isMatch) return next(new AppError('Incorrect password', 401));

        const staffRegionId = await resolveStaffRegionId(req.user);

        console.log('Staff Region ID:', staffRegionId);
        const filterQuery: any = { orderNumber };
        if (staffRegionId) filterQuery.region = staffRegionId;

        const order = await Order.findOne(filterQuery);
        if (!order) return next(new AppError('Order not found or not in your region', 404));

        if (order.orderStatus === 'cancelled') {
            return next(new AppError('Order is already cancelled', 400));
        }
        if (order.orderStatus === 'delivered') {
            return next(new AppError('Cannot cancel a delivered order', 400));
        }

        await order.cancelOrder(`${reason} — ${note}`, req.user.id);

        await logActivity(req, {
            action: ACTIONS.ORDER_CANCELLED,
            description: `Cancelled order #${order.orderNumber}. Reason: "${reason}" — ${note}`,
            targetId: order.orderNumber,
            targetType: 'Order',
            targetName: `#${order.orderNumber}`,
            before: { orderStatus: order.orderStatus },
            after: { orderStatus: 'cancelled' },
            metadata: { reason, note },
        });

        await NotificationController.saveAndSendNotification({
            userId: order.userId.toString(),
            title: 'Order Cancelled',
            body: `Your order #${order.orderNumber} has been cancelled. If you were charged, a refund will be processed within 3–5 business days.`,
            type: 'order',
            typeId: { orderId: order._id },
            clickUrl: `/orders/${order._id}`,
            priority: 'high'
        }, 'user', { push_notification: true });

        (res as AppResponse).data({ order }, 'Order cancelled successfully');
    },
);

export const updateOrderStatus = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return next(new AppError('Not authenticated', 401));

        const { orderNumber } = req.params;
        const { status, note } = req.body;

        if (!status) return next(new AppError('status is required', 400));

        const newStatus = buildOrderStatusFilter(status);
        if (!newStatus) return next(new AppError('Invalid status value', 400));

        const staffRegionId = await resolveStaffRegionId(req.user);
        console.log('Staff Region ID:', staffRegionId);
        const filterQuery: any = { orderNumber };
        // if (staffRegionId) filterQuery.region = staffRegionId;

        const order = await Order.findOne(filterQuery);

        if (!order) return next(new AppError('Order not found or not in your region', 404));
        if (!staffRegionId) return next(new AppError('Invalid staff region', 404));


        await order.updateStatus(newStatus, note ?? '', req.user.id);
        if (newStatus === "ready") {
            await dispatchOrderToDrivers(order.id, undefined, 3.5);
        }

        if (newStatus === "confirmed") {
            order.region = staffRegionId
            order.save()
            await NotificationController.saveAndSendNotification({
                userId: order.userId.toString(),
                title: 'Order Confirmed ✅',
                body: `Great news! Your order #${order.orderNumber} has been confirmed and is being prepared.`,
                type: 'order',
                typeId: { orderId: order._id },
                clickUrl: `/orders/${order._id}`,
                priority: 'high'
            }, 'user', { push_notification: true });
        }

        if (newStatus === 'processing') {
            await NotificationController.saveAndSendNotification({
                userId: order.userId.toString(),
                title: 'Order Being Prepared 🛍️',
                body: `Your order #${order.orderNumber} is now being packed and prepared for delivery.`,
                type: 'order',
                typeId: { orderId: order._id },
                clickUrl: `/orders/${order._id}`,
                priority: 'medium'
            }, 'user', { push_notification: true });
        }

        (res as AppResponse).data({ order }, 'Order status updated successfully');
    },
);

export const transferOrder = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return next(new AppError('Not authenticated', 401));

        const { orderNumber } = req.params;
        const { trackingNumber, carrier, estimatedDelivery } = req.body;

        if (!trackingNumber && !carrier) {
            return next(new AppError('Provide at least a trackingNumber or carrier', 400));
        }

        const staffRegionId = await resolveStaffRegionId(req.user);
        const filterQuery: any = { orderNumber };
        if (staffRegionId) filterQuery.region = staffRegionId;

        const order = await Order.findOne(filterQuery);
        if (!order) return next(new AppError('Order not found or not in your region', 404));

        if (['cancelled', 'delivered'].includes(order.orderStatus)) {
            return next(new AppError(`Cannot transfer a ${order.orderStatus} order`, 400));
        }

        await order.addTrackingInfo(
            trackingNumber,
            carrier,
            estimatedDelivery ? new Date(estimatedDelivery) : undefined,
        );

        await logActivity(req, {
            action: ACTIONS.ORDER_TRANSFERRED,
            description: `Added tracking info to order #${order.orderNumber}. Carrier: ${carrier ?? '-'}, Tracking: ${trackingNumber ?? '-'}`,
            targetId: order.orderNumber,
            targetType: 'Order',
            targetName: `#${order.orderNumber}`,
            metadata: { trackingNumber, carrier, estimatedDelivery },
        });

        (res as AppResponse).data({ order }, 'Order transfer info updated successfully');
    },
);
