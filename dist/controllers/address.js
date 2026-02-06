"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultAddress = exports.setDefaultAddress = exports.deleteAddress = exports.updateAddress = exports.createAddress = exports.getAddress = exports.getAddresses = void 0;
const Address_1 = __importDefault(require("../models/Address"));
const User_1 = __importDefault(require("../models/User"));
const error_1 = require("../middleware/error");
// @desc    Get all addresses for a user
// @route   GET /api/v1/addresses
// @access  Private
exports.getAddresses = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const addresses = await Address_1.default.find({ userId: req.user.id })
        .sort({ isDefault: -1, createdAt: -1 });
    res.data({
        addresses,
        count: addresses.length
    }, 'Addresses retrieved successfully');
});
// @desc    Get single address
// @route   GET /api/v1/addresses/:id
// @access  Private
exports.getAddress = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const address = await Address_1.default.findOne({
        _id: req.params.id,
        userId: req.user.id
    });
    if (!address) {
        return next(new error_1.AppError('Address not found', 404));
    }
    res.data({ address }, 'Address retrieved successfully');
});
// @desc    Create new address
// @route   POST /api/v1/addresses
// @access  Private
exports.createAddress = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { label, fullname, address, phone, state } = req.body;
    if (!label || !fullname || !address || !phone || !state) {
        return next(new error_1.AppError('Please provide all required fields: label, fullname, address, phone, state', 400));
    }
    const addressCount = await Address_1.default.countDocuments({ userId: req.user.id });
    if (addressCount === 0) {
        req.body.isDefault = true;
    }
    req.body.userId = req.user.id;
    const newAddress = await Address_1.default.create(req.body);
    await User_1.default.findByIdAndUpdate(req.user.id, {
        $addToSet: { addresses: newAddress._id },
        ...(newAddress.isDefault && { defaultAddress: newAddress._id })
    });
    res.data({ address: newAddress }, 'Address created successfully', 201);
});
// @desc    Update address
// @route   PUT /api/v1/addresses/:id
// @access  Private
exports.updateAddress = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    let address = await Address_1.default.findOne({
        _id: req.params.id,
        userId: req.user.id
    });
    if (!address) {
        return next(new error_1.AppError('Address not found', 404));
    }
    delete req.body.userId;
    address = await Address_1.default.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });
    if (req.body.isDefault) {
        await User_1.default.findByIdAndUpdate(req.user.id, { defaultAddress: address._id });
    }
    res.data({ address }, 'Address updated successfully');
});
// @desc    Delete address
// @route   DELETE /api/v1/addresses/:id
// @access  Private
exports.deleteAddress = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const address = await Address_1.default.findOne({
        _id: req.params.id,
        userId: req.user.id
    });
    if (!address) {
        return next(new error_1.AppError('Address not found', 404));
    }
    const wasDefault = address.isDefault;
    await address.deleteOne();
    await User_1.default.findByIdAndUpdate(req.user.id, {
        $pull: { addresses: address._id },
        ...(wasDefault && { $unset: { defaultAddress: 1 } })
    });
    if (wasDefault) {
        const nextAddress = await Address_1.default.findOne({ userId: req.user.id })
            .sort({ createdAt: -1 });
        if (nextAddress) {
            nextAddress.isDefault = true;
            await nextAddress.save();
            await User_1.default.findByIdAndUpdate(req.user.id, { defaultAddress: nextAddress._id });
        }
    }
    res.success('Address deleted successfully');
});
// @desc    Set default address
// @route   PATCH /api/v1/addresses/:id/default
// @access  Private
exports.setDefaultAddress = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const address = await Address_1.default.findOne({
        _id: req.params.id,
        userId: req.user.id
    });
    if (!address) {
        return next(new error_1.AppError('Address not found', 404));
    }
    await Address_1.default.updateMany({ userId: req.user.id }, { $set: { isDefault: false } });
    address.isDefault = true;
    await address.save();
    await User_1.default.findByIdAndUpdate(req.user.id, { defaultAddress: address._id });
    res.data({ address }, 'Default address set successfully');
});
// @desc    Get default address
// @route   GET /api/v1/addresses/default
// @access  Private
exports.getDefaultAddress = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const address = await Address_1.default.findOne({
        userId: req.user.id,
        isDefault: true
    });
    if (!address) {
        return next(new error_1.AppError('No default address found', 404));
    }
    res.data({ address }, 'Default address retrieved successfully');
});
//# sourceMappingURL=address.js.map