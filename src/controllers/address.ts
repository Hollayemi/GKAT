import { Request, Response, NextFunction } from 'express';
import Address from '../models/Address';
import User from '../models/User';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';

// @desc    Get all addresses for a user
// @route   GET /api/v1/addresses
// @access  Private
export const getAddresses = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const addresses = await Address.find({ userId: req.user.id })
        .sort({ isDefault: -1, createdAt: -1 });

    (res as AppResponse).data({
        addresses,
        count: addresses.length
    }, 'Addresses retrieved successfully');
});

// @desc    Get single address
// @route   GET /api/v1/addresses/:id
// @access  Private
export const getAddress = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const address = await Address.findOne({
        _id: req.params.id,
        userId: req.user.id
    });

    if (!address) {
        return next(new AppError('Address not found', 404));
    }

    (res as AppResponse).data({ address }, 'Address retrieved successfully');
});

// @desc    Create new address
// @route   POST /api/v1/addresses
// @access  Private
export const createAddress = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const { label, fullname, address, phone, state } = req.body;

    if (!label || !fullname || !address || !phone || !state) {
        return next(new AppError('Please provide all required fields: label, fullname, address, phone, state', 400));
    }

    const addressCount = await Address.countDocuments({ userId: req.user.id });

    if (addressCount === 0) {
        req.body.isDefault = true;
    }

    req.body.userId = req.user.id;
    const newAddress = await Address.create(req.body);

    await User.findByIdAndUpdate(
        req.user.id,
        {
            $addToSet: { addresses: newAddress._id },
            ...(newAddress.isDefault && { defaultAddress: newAddress._id })
        }
    );

    (res as AppResponse).data(
        { address: newAddress },
        'Address created successfully',
        201
    );
});

// @desc    Update address
// @route   PUT /api/v1/addresses/:id
// @access  Private
export const updateAddress = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    let address = await Address.findOne({
        _id: req.params.id,
        userId: req.user.id
    });

    if (!address) {
        return next(new AppError('Address not found', 404));
    }

    delete req.body.userId;

    address = await Address.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    if (req.body.isDefault) {
        await User.findByIdAndUpdate(
            req.user.id,
            { defaultAddress: address!._id }
        );
    }

    (res as AppResponse).data({ address }, 'Address updated successfully');
});

// @desc    Delete address
// @route   DELETE /api/v1/addresses/:id
// @access  Private
export const deleteAddress = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const address = await Address.findOne({
        _id: req.params.id,
        userId: req.user.id
    });

    if (!address) {
        return next(new AppError('Address not found', 404));
    }

    const wasDefault = address.isDefault;

    await address.deleteOne();

    await User.findByIdAndUpdate(
        req.user.id,
        {
            $pull: { addresses: address._id },
            ...(wasDefault && { $unset: { defaultAddress: 1 } })
        }
    );

    if (wasDefault) {
        const nextAddress = await Address.findOne({ userId: req.user.id })
            .sort({ createdAt: -1 });

        if (nextAddress) {
            nextAddress.isDefault = true;
            await nextAddress.save();

            await User.findByIdAndUpdate(
                req.user.id,
                { defaultAddress: nextAddress._id }
            );
        }
    }

    (res as AppResponse).success('Address deleted successfully');
});

// @desc    Set default address
// @route   PATCH /api/v1/addresses/:id/default
// @access  Private
export const setDefaultAddress = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const address = await Address.findOne({
        _id: req.params.id,
        userId: req.user.id
    });

    if (!address) {
        return next(new AppError('Address not found', 404));
    }

    await Address.updateMany(
        { userId: req.user.id },
        { $set: { isDefault: false } }
    );

    address.isDefault = true;
    await address.save();

    await User.findByIdAndUpdate(
        req.user.id,
        { defaultAddress: address._id }
    );

    (res as AppResponse).data({ address }, 'Default address set successfully');
});

// @desc    Get default address
// @route   GET /api/v1/addresses/default
// @access  Private
export const getDefaultAddress = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const address = await Address.findOne({
        userId: req.user.id,
        isDefault: true
    });

    if (!address) {
        return next(new AppError('No default address found', 404));
    }

    (res as AppResponse).data({ address }, 'Default address retrieved successfully');
});