import { Request, Response, NextFunction } from 'express';
import Order from '../../models/Orders';
import Driver from '../../models/Driver';
import DriverWallet from '../../models/DriverWallet';
import DriverDelivery from '../../models/DriverDelivery';
import Address from '../../models/Address';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import mongoose from 'mongoose';
import { resolveStaffRegionId } from '../../helpers/regionScope';
import NotificationController from '../others/notification';
import { dispatchOrderToDrivers } from '../rider/orders';



const calculateFare = (distanceKm: number, isPriority = false) => {
    const BASE_FARE = 900;
    const DISTANCE_BONUS_PER_KM = 89;
    const PRIORITY_FEE = isPriority ? 50 : 0;
    const distanceBonus = Math.round(distanceKm * DISTANCE_BONUS_PER_KM);
    return { baseFare: BASE_FARE, distanceBonus, priorityFee: PRIORITY_FEE, totalEarned: BASE_FARE + distanceBonus + PRIORITY_FEE };
};


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

    if (order.orderStatus !== "ready") {
        return next(new AppError(
            `Cannot assign driver to order with status "${order.orderStatus}". Order must be paid or confirmed.`,
            400
        ));
    }

    const driver = await Driver.findById(driverId).populate('userId', 'name email phoneNumber');
    if (!driver) return next(new AppError('Driver not found', 404));

    if (driver.verificationStatus !== 'verified') {
        return next(new AppError('Driver must be verified before assignment', 400));
    }
    if (driver.status === 'suspended' || driver.status === 'disabled') {
        return next(new AppError(`Driver account is ${driver.status} and cannot be assigned`, 400));
    }

    const activeDelivery = await DriverDelivery.findOne({
        driverId: driver._id,
        status: { $in: ['accepted', 'arrived_at_store', 'picked_up', 'in_transit', 'arrived_at_customer'] }
    });
    if (activeDelivery) {
        return next(new AppError('Driver is currently on an active delivery', 409));
    }

    const existingOrderDelivery = await DriverDelivery.findOne({
        orderId: order._id,
        status: { $nin: ['cancelled', 'rejected'] }
    });
    if (existingOrderDelivery) {
        return next(new AppError('This order already has an active delivery assignment', 409));
    }

    let deliveryAddress = 'Customer Location';
    try {
        const addressDoc = await Address.findById(order.shippingAddress).lean() as any;
        if (addressDoc) {
            deliveryAddress = [addressDoc.address, addressDoc.localGovernment, addressDoc.state]
                .filter(Boolean).join(', ');
        }
    } catch (_) { }

    const delivery = await dispatchOrderToDrivers(order.id, driver.id, distanceKm,);

    await order.updateStatus('ready', `Driver assigned by admin: ${(driver.userId as any)?.name || driver._id}`);

    driver.status = 'on-delivery';
    await driver.save();

    const walletExists = await DriverWallet.findOne({ driverId: driver._id });
    if (!walletExists) {
        await DriverWallet.create({
            driverId: driver._id,
            userId: driver.userId,
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            totalDeliveries: 0,
        });
    }

    (res as AppResponse).data(
        {
            delivery: {
                _id: delivery._id,
                orderNumber: delivery.orderNumber,
                status: delivery.status,
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
