import { Request, Response, NextFunction } from 'express';
import Order from '../../models/Orders';
import Driver from '../../models/Driver';
import DriverDelivery from '../../models/DriverDelivery';
import Address from '../../models/Address';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import mongoose from 'mongoose';
import { resolveStaffRegionId } from '../../helpers/regionScope';
import NotificationController from '../others/notification';
 


const calculateFare = (distanceKm: number, isPriority = false) => {
    const BASE_FARE = 900;
    const DISTANCE_BONUS_PER_KM = 89;
    const PRIORITY_FEE = isPriority ? 50 : 0;
    const distanceBonus = Math.round(distanceKm * DISTANCE_BONUS_PER_KM);
    return { baseFare: BASE_FARE, distanceBonus, priorityFee: PRIORITY_FEE, totalEarned: BASE_FARE + distanceBonus + PRIORITY_FEE };
};

const generateDeliveryPin = (): string =>
    Math.floor(1000 + Math.random() * 9000).toString();

// @desc    Admin assigns a specific driver to an order
// @route   POST /api/v1/admin/orders/:orderNumber/assign-driver
// @access  Private/Admin
export const assignDriverToOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { orderNumber } = req.params;
    const { driverId, distanceKm = 3.5, isPriority = false, pickupAddress } = req.body;

    if (!driverId) return next(new AppError('driverId is required', 400));

    const staffRegionId = await resolveStaffRegionId(req.user);
    const orderQuery: any = { orderNumber };
    if (staffRegionId) orderQuery.region = staffRegionId;

    const order = await Order.findOne(orderQuery).populate('userId', 'name email');
    if (!order) return next(new AppError('Order not found or not in your region', 404));

    // Only paid or confirmed orders can be assigned
    if (!['paid', 'confirmed'].includes(order.orderStatus)) {
        return next(new AppError(
            `Cannot assign driver to order with status "${order.orderStatus}". Order must be paid or confirmed.`,
            400
        ));
    }

    // Validate driver
    const driver = await Driver.findById(driverId).populate('userId', 'name email phoneNumber');
    if (!driver) return next(new AppError('Driver not found', 404));

    if (driver.verificationStatus !== 'verified') {
        return next(new AppError('Driver must be verified before assignment', 400));
    }
    if (driver.status === 'suspended' || driver.status === 'disabled') {
        return next(new AppError(`Driver account is ${driver.status} and cannot be assigned`, 400));
    }

    // Check driver is not already on a delivery
    const activeDelivery = await DriverDelivery.findOne({
        driverId: driver._id,
        status: { $in: ['accepted', 'arrived_at_store', 'picked_up', 'in_transit', 'arrived_at_customer'] }
    });
    if (activeDelivery) {
        return next(new AppError('Driver is currently on an active delivery', 409));
    }

    // Check no existing active delivery for this order
    const existingOrderDelivery = await DriverDelivery.findOne({
        orderId: order._id,
        status: { $nin: ['cancelled', 'rejected'] }
    });
    if (existingOrderDelivery) {
        return next(new AppError('This order already has an active delivery assignment', 409));
    }

    // Resolve delivery address
    let deliveryAddress = 'Customer Location';
    try {
        const addressDoc = await Address.findById(order.shippingAddress).lean() as any;
        if (addressDoc) {
            deliveryAddress = [addressDoc.address, addressDoc.localGovernment, addressDoc.state]
                .filter(Boolean).join(', ');
        }
    } catch (_) {}

    const now = new Date();
    const fare = calculateFare(Number(distanceKm), Boolean(isPriority));
    const pin = generateDeliveryPin();

    const delivery = await DriverDelivery.create({
        orderId: order._id,
        driverId: driver._id,
        userId: order.userId,
        orderNumber: order.orderNumber,
        pickupAddress: pickupAddress || `${driver.region} Warehouse`,
        deliveryAddress,
        distanceKm: Number(distanceKm),
        fareBreakdown: fare,
        deliveryPin: pin,
        broadcastedAt: now,
        // Admin-assigned deliveries get a longer window (1 hour)
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        status: 'accepted',
        statusHistory: [
            { status: 'pending_acceptance', timestamp: now, note: 'Dispatched by admin' },
            { status: 'accepted', timestamp: now, note: `Assigned to ${(driver.userId as any)?.name || 'driver'} by admin` },
        ],
    });

    // Update order status to processing
    await order.updateStatus('processing', `Driver assigned by admin: ${(driver.userId as any)?.name || driver._id}`);

    // Mark driver as on-delivery
    driver.status = 'on-delivery';
    await driver.save();

    // Notify customer with delivery PIN
    try {
        await NotificationController.saveAndSendNotification({
            userId: order.userId.toString(),
            title: 'Driver Assigned to Your Order!',
            body: `A driver has been assigned to your order #${order.orderNumber}. Your delivery PIN is: ${pin}`,
            type: 'order',
            typeId: { orderId: order._id },
            clickUrl: `/orders/${order._id}`,
            priority: 'high',
        }, 'user', { push_notification: true });
    } catch (notifErr) {
        console.error('Failed to send assignment notification:', notifErr);
    }

    (res as AppResponse).data(
        {
            delivery: {
                _id: delivery._id,
                orderNumber: delivery.orderNumber,
                status: delivery.status,
                deliveryPin: delivery.deliveryPin,
                fareBreakdown: delivery.fareBreakdown,
                distanceKm: delivery.distanceKm,
                pickupAddress: delivery.pickupAddress,
                deliveryAddress: delivery.deliveryAddress,
            },
            driver: {
                _id: driver._id,
                fullName: (driver.userId as any)?.name,
                phone: driver.phone,
                vehicleType: driver.vehicleType,
                vehiclePlateNumber: driver.vehiclePlateNumber,
            },
            orderStatus: 'processing',
        },
        'Driver assigned to order successfully',
        201
    );
});


export const getAvailableDrivers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { region, search } = req.query;
 
    console.log('Fetching available drivers with filters:', { region, search });

    const staffRegionId = await resolveStaffRegionId(req.user);

    console.log('Resolved staff region ID:', staffRegionId);   
 
    const query: any = {
        status: 'active',
        verificationStatus: 'verified',
    };
 
    // Region scoping
    if (staffRegionId) {
        query.region = staffRegionId.toString();
    } else if (region) {
        query.region = region;
    }
 
    if (search) {
        query.$or = [
            { phone: { $regex: search, $options: 'i' } },
            { vehiclePlateNumber: { $regex: search, $options: 'i' } },
        ];
    }
 
    // Get all matching drivers
    const drivers = await Driver.find(query)
        .populate('userId', 'name email phoneNumber avatar')
        .select('-password -passwordSetupToken -passwordSetupExpiry')
        .lean();
 
    // Find driver IDs that are currently on an active delivery
    const busyDriverIds = await DriverDelivery.find({
        status: { $in: ['accepted', 'arrived_at_store', 'picked_up', 'in_transit', 'arrived_at_customer'] }
    }).distinct('driverId');
 
    const busySet = new Set(busyDriverIds.map(id => id.toString()));
 
    const available = drivers
        .filter(d => !busySet.has(d._id.toString()))
        .map(d => ({
            _id: d._id,
            fullName: (d.userId as any)?.name || 'Unknown',
            email: (d.userId as any)?.email || '',
            phone: d.phone,
            avatar: (d.userId as any)?.avatar || d.profilePhoto || null,
            vehicleType: d.vehicleType,
            vehiclePlateNumber: d.vehiclePlateNumber,
            vehicleModel: d.vehicleModel,
            region: d.region,
            rating: d.rating,
            totalDeliveries: d.totalDeliveries,
            completedDeliveries: d.completedDeliveries,
            isOnline: d.isOnline,
            status: d.status,
        }));
 
    (res as AppResponse).data(
        { drivers: available, total: available.length },
        'Available drivers retrieved successfully'
    );
});
 