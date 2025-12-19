"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBulkUpdate = exports.validateStockUpdate = exports.validateVariant = exports.validateProductUpdate = exports.validateProductCreate = void 0;
const error_1 = require("./error");
const productValidationRules = {
    productName: {
        required: true,
        minLength: 3,
        maxLength: 200
    },
    sku: {
        required: true,
        pattern: /^[A-Z0-9-]+$/
    },
    category: {
        required: true,
        enum: ['Packaged Foods', 'Beverages', 'Fresh Produce', 'Dairy', 'Meat & Seafood',
            'Bakery', 'Snacks', 'Household', 'Personal Care', 'Other']
    },
    description: {
        required: true,
        minLength: 10,
        maxLength: 2000
    },
    salesPrice: {
        required: true,
        min: 0
    },
    unitType: {
        required: true,
        enum: ['single', 'pack', 'carton', 'kg', 'litre', 'box']
    },
    unitQuantity: {
        required: true
    },
    stockQuantity: {
        required: true,
        min: 0
    },
    images: {
        required: true,
        minLength: 1
    }
};
const validateProductCreate = (req, res, next) => {
    const errors = [];
    const { body } = req;
    console.log({ body });
    if (!body.productName || body.productName.trim().length === 0) {
        errors.push('Product name is required');
    }
    else if (body.productName.length < 3) {
        errors.push('Product name must be at least 3 characters');
    }
    else if (body.productName.length > 200) {
        errors.push('Product name cannot exceed 200 characters');
    }
    if (!body.sku || body.sku.trim().length === 0) {
        errors.push('SKU is required');
    }
    else if (!/^[A-Z0-9-]+$/.test(body.sku.toUpperCase())) {
        errors.push('SKU can only contain uppercase letters, numbers, and hyphens');
    }
    if (!body.category) {
        errors.push('Category is required');
    }
    else if (!productValidationRules.category.enum.includes(body.category)) {
        errors.push('Invalid category');
    }
    if (!body.description || body.description.trim().length === 0) {
        errors.push('Description is required');
    }
    else if (body.description.length < 10) {
        errors.push('Description must be at least 10 characters');
    }
    else if (body.description.length > 2000) {
        errors.push('Description cannot exceed 2000 characters');
    }
    if (body.salesPrice === undefined || body.salesPrice === null) {
        errors.push('Sales price is required');
    }
    else if (parseInt(body.salesPrice) < 0) {
        errors.push('Sales price must be a positive number');
    }
    if (!body.unitType) {
        errors.push('Unit type is required');
    }
    else if (!productValidationRules.unitType.enum.includes(body.unitType)) {
        errors.push('Invalid unit type');
    }
    if (!body.unitQuantity || body.unitQuantity.trim().length === 0) {
        errors.push('Unit quantity is required');
    }
    if (body.stockQuantity === undefined || body.stockQuantity === null) {
        errors.push('Stock quantity is required');
    }
    else if (parseInt(body.stockQuantity) < 0) {
        errors.push('Stock quantity must be a non-negative number');
    }
    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
        errors.push('At least one product image is required');
    }
    if (body.status && !['active', 'inactive', 'draft'].includes(body.status)) {
        errors.push('Invalid status');
    }
    if (errors.length > 0) {
        return next(new error_1.AppError(errors.join(', '), 400));
    }
    req.body.sku = body.sku.toUpperCase();
    next();
};
exports.validateProductCreate = validateProductCreate;
const validateProductUpdate = (req, res, next) => {
    const errors = [];
    const { body } = req;
    if (body.productName !== undefined) {
        if (body.productName.trim().length === 0) {
            errors.push('Product name cannot be empty');
        }
        else if (body.productName.length < 3) {
            errors.push('Product name must be at least 3 characters');
        }
        else if (body.productName.length > 200) {
            errors.push('Product name cannot exceed 200 characters');
        }
    }
    if (body.sku !== undefined) {
        if (body.sku.trim().length === 0) {
            errors.push('SKU cannot be empty');
        }
        else if (!/^[A-Z0-9-]+$/.test(body.sku.toUpperCase())) {
            errors.push('SKU can only contain uppercase letters, numbers, and hyphens');
        }
        else {
            req.body.sku = body.sku.toUpperCase();
        }
    }
    if (body.category !== undefined && !productValidationRules.category.enum.includes(body.category)) {
        errors.push('Invalid category');
    }
    if (body.description !== undefined) {
        if (body.description.trim().length === 0) {
            errors.push('Description cannot be empty');
        }
        else if (body.description.length < 10) {
            errors.push('Description must be at least 10 characters');
        }
        else if (body.description.length > 2000) {
            errors.push('Description cannot exceed 2000 characters');
        }
    }
    if (body.salesPrice !== undefined && parseInt(body.salesPrice) < 0) {
        errors.push('Sales price must be a positive number');
    }
    if (body.unitType !== undefined && !productValidationRules.unitType.enum.includes(body.unitType)) {
        errors.push('Invalid unit type');
    }
    if (body.stockQuantity !== undefined && parseInt(body.stockQuantity) < 0) {
        errors.push('Stock quantity must be a non-negative number');
    }
    if (body.status !== undefined && !['active', 'inactive', 'draft'].includes(body.status)) {
        errors.push('Invalid status');
    }
    if (errors.length > 0) {
        return next(new error_1.AppError(errors.join(', '), 400));
    }
    next();
};
exports.validateProductUpdate = validateProductUpdate;
const validateVariant = (req, res, next) => {
    const errors = [];
    const { body } = req;
    if (!body.sku || body.sku.trim().length === 0) {
        errors.push('Variant SKU is required');
    }
    else if (!/^[A-Z0-9-]+$/.test(body.sku.toUpperCase())) {
        errors.push('SKU can only contain uppercase letters, numbers, and hyphens');
    }
    if (!body.productId || body.productId.trim().length === 0) {
        errors.push('Product ID is required');
    }
    if (body.salesPrice === undefined || body.salesPrice === null) {
        errors.push('Sales price is required');
    }
    else if (typeof body.salesPrice !== 'number' || body.salesPrice < 0) {
        errors.push('Sales price must be a positive number');
    }
    if (!body.unitType) {
        errors.push('Unit type is required');
    }
    else if (!productValidationRules.unitType.enum.includes(body.unitType)) {
        errors.push('Invalid unit type');
    }
    if (!body.unitQuantity || body.unitQuantity.trim().length === 0) {
        errors.push('Unit quantity is required');
    }
    if (body.stockQuantity === undefined || body.stockQuantity === null) {
        errors.push('Stock quantity is required');
    }
    else if (typeof body.stockQuantity !== 'number' || body.stockQuantity < 0) {
        errors.push('Stock quantity must be a non-negative number');
    }
    if (errors.length > 0) {
        return next(new error_1.AppError(errors.join(', '), 400));
    }
    req.body.sku = body.sku.toUpperCase();
    next();
};
exports.validateVariant = validateVariant;
const validateStockUpdate = (req, res, next) => {
    const errors = [];
    const { body } = req;
    if (body.stockQuantity !== undefined) {
        if (typeof body.stockQuantity !== 'number' || body.stockQuantity < 0) {
            errors.push('Stock quantity must be a non-negative number');
        }
    }
    if (body.variantStock !== undefined) {
        if (typeof body.variantStock !== 'number' || body.variantStock < 0) {
            errors.push('Variant stock must be a non-negative number');
        }
        if (!body.variantId) {
            errors.push('Variant ID is required when updating variant stock');
        }
    }
    if (errors.length > 0) {
        return next(new error_1.AppError(errors.join(', '), 400));
    }
    next();
};
exports.validateStockUpdate = validateStockUpdate;
const validateBulkUpdate = (req, res, next) => {
    const errors = [];
    const { productIds, updates } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        errors.push('Product IDs array is required');
    }
    if (!updates || typeof updates !== 'object') {
        errors.push('Updates object is required');
    }
    if (errors.length > 0) {
        return next(new error_1.AppError(errors.join(', '), 400));
    }
    next();
};
exports.validateBulkUpdate = validateBulkUpdate;
//# sourceMappingURL=productValidation.js.map