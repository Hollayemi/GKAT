"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCouponUpdate = exports.validateCouponCreate = void 0;
const error_1 = require("./error");
const validateCouponCreate = (req, res, next) => {
    const errors = [];
    const { promotionName, promoType, couponCode, discountValue, usageLimit, perUserLimit, minimumOrderValue, startDateTime, endDateTime } = req.body;
    if (!promotionName || promotionName.trim().length === 0) {
        errors.push('Promotion name is required');
    }
    else if (promotionName.length > 100) {
        errors.push('Promotion name cannot exceed 100 characters');
    }
    if (!promoType || promoType.trim().length === 0) {
        errors.push('Promo type is required');
    }
    if (!couponCode || couponCode.trim().length === 0) {
        errors.push('Coupon code is required');
    }
    else if (couponCode.length > 20) {
        errors.push('Coupon code cannot exceed 20 characters');
    }
    else if (!/^[A-Z0-9]+$/i.test(couponCode)) {
        errors.push('Coupon code can only contain letters and numbers');
    }
    if (discountValue === undefined || discountValue === null) {
        errors.push('Discount value is required');
    }
    else {
        const value = parseFloat(discountValue);
        if (isNaN(value) || value <= 0) {
            errors.push('Discount value must be greater than 0');
        }
        if (promoType && (promoType.toLowerCase().includes('percentage') ||
            promoType.toLowerCase().includes('%'))) {
            if (value < 0 || value > 100) {
                errors.push('Percentage discount must be between 0 and 100');
            }
        }
    }
    if (usageLimit === undefined || usageLimit === null) {
        errors.push('Usage limit is required');
    }
    else {
        const limit = parseInt(usageLimit);
        if (isNaN(limit) || limit <= 0) {
            errors.push('Usage limit must be greater than 0');
        }
    }
    if (perUserLimit === undefined || perUserLimit === null) {
        errors.push('Per user limit is required');
    }
    else {
        const limit = parseInt(perUserLimit);
        if (isNaN(limit) || limit <= 0) {
            errors.push('Per user limit must be greater than 0');
        }
    }
    if (minimumOrderValue !== undefined && minimumOrderValue !== null && minimumOrderValue !== '') {
        const value = parseFloat(minimumOrderValue);
        if (isNaN(value) || value < 0) {
            errors.push('Minimum order value must be 0 or greater');
        }
    }
    if (!startDateTime) {
        errors.push('Start date & time is required');
    }
    else {
        const startDate = new Date(startDateTime);
        if (isNaN(startDate.getTime())) {
            errors.push('Invalid start date & time format');
        }
    }
    if (!endDateTime) {
        errors.push('End date & time is required');
    }
    else {
        const endDate = new Date(endDateTime);
        if (isNaN(endDate.getTime())) {
            errors.push('Invalid end date & time format');
        }
        if (startDateTime) {
            const startDate = new Date(startDateTime);
            if (endDate <= startDate) {
                errors.push('End date & time must be after start date & time');
            }
        }
    }
    if (req.body.applicableCategories) {
        if (!Array.isArray(req.body.applicableCategories)) {
            errors.push('Applicable categories must be an array');
        }
    }
    if (errors.length > 0) {
        return next(new error_1.AppError(errors.join(', '), 400));
    }
    req.body.promotionName = promotionName.trim();
    req.body.promoType = promoType.trim();
    req.body.couponCode = couponCode.trim().toUpperCase();
    req.body.discountValue = parseFloat(discountValue);
    req.body.usageLimit = parseInt(usageLimit);
    req.body.perUserLimit = parseInt(perUserLimit);
    if (minimumOrderValue !== undefined && minimumOrderValue !== null && minimumOrderValue !== '') {
        req.body.minimumOrderValue = parseFloat(minimumOrderValue);
    }
    else {
        req.body.minimumOrderValue = 0;
    }
    next();
};
exports.validateCouponCreate = validateCouponCreate;
const validateCouponUpdate = (req, res, next) => {
    const errors = [];
    const { promotionName, promoType, couponCode, discountValue, usageLimit, perUserLimit, minimumOrderValue, startDateTime, endDateTime } = req.body;
    if (promotionName !== undefined) {
        if (promotionName.trim().length === 0) {
            errors.push('Promotion name cannot be empty');
        }
        else if (promotionName.length > 100) {
            errors.push('Promotion name cannot exceed 100 characters');
        }
        else {
            req.body.promotionName = promotionName.trim();
        }
    }
    if (promoType !== undefined) {
        if (promoType.trim().length === 0) {
            errors.push('Promo type cannot be empty');
        }
        else {
            req.body.promoType = promoType.trim();
        }
    }
    if (couponCode !== undefined) {
        if (couponCode.trim().length === 0) {
            errors.push('Coupon code cannot be empty');
        }
        else if (couponCode.length > 20) {
            errors.push('Coupon code cannot exceed 20 characters');
        }
        else if (!/^[A-Z0-9]+$/i.test(couponCode)) {
            errors.push('Coupon code can only contain letters and numbers');
        }
        else {
            req.body.couponCode = couponCode.trim().toUpperCase();
        }
    }
    if (discountValue !== undefined && discountValue !== null) {
        const value = parseFloat(discountValue);
        if (isNaN(value) || value <= 0) {
            errors.push('Discount value must be greater than 0');
        }
        else {
            req.body.discountValue = value;
            const typeToCheck = promoType || req.body.promoType;
            if (typeToCheck && (typeToCheck.toLowerCase().includes('percentage') ||
                typeToCheck.toLowerCase().includes('%'))) {
                if (value < 0 || value > 100) {
                    errors.push('Percentage discount must be between 0 and 100');
                }
            }
        }
    }
    if (usageLimit !== undefined && usageLimit !== null) {
        const limit = parseInt(usageLimit);
        if (isNaN(limit) || limit <= 0) {
            errors.push('Usage limit must be greater than 0');
        }
        else {
            req.body.usageLimit = limit;
        }
    }
    if (perUserLimit !== undefined && perUserLimit !== null) {
        const limit = parseInt(perUserLimit);
        if (isNaN(limit) || limit <= 0) {
            errors.push('Per user limit must be greater than 0');
        }
        else {
            req.body.perUserLimit = limit;
        }
    }
    if (minimumOrderValue !== undefined && minimumOrderValue !== null && minimumOrderValue !== '') {
        const value = parseFloat(minimumOrderValue);
        if (isNaN(value) || value < 0) {
            errors.push('Minimum order value must be 0 or greater');
        }
        else {
            req.body.minimumOrderValue = value;
        }
    }
    if (startDateTime !== undefined) {
        const startDate = new Date(startDateTime);
        if (isNaN(startDate.getTime())) {
            errors.push('Invalid start date & time format');
        }
    }
    if (endDateTime !== undefined) {
        const endDate = new Date(endDateTime);
        if (isNaN(endDate.getTime())) {
            errors.push('Invalid end date & time format');
        }
    }
    if (startDateTime && endDateTime) {
        const startDate = new Date(startDateTime);
        const endDate = new Date(endDateTime);
        if (endDate <= startDate) {
            errors.push('End date & time must be after start date & time');
        }
    }
    if (req.body.applicableCategories !== undefined) {
        if (!Array.isArray(req.body.applicableCategories)) {
            errors.push('Applicable categories must be an array');
        }
    }
    if (errors.length > 0) {
        return next(new error_1.AppError(errors.join(', '), 400));
    }
    next();
};
exports.validateCouponUpdate = validateCouponUpdate;
//# sourceMappingURL=couponValidation.js.map