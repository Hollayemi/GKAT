"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRoleAssignment = exports.validateStaffUpdate = exports.validateStaffLogin = exports.validateStaffCreate = void 0;
const error_1 = require("./error");
// Validate staff creation
const validateStaffCreate = (req, res, next) => {
    const { fullName, email, phone, role } = req.body;
    const errors = {};
    // Full name validation
    if (!fullName || fullName.trim().length === 0) {
        errors.fullName = ['Full name is required'];
    }
    else if (fullName.length > 100) {
        errors.fullName = ['Full name cannot exceed 100 characters'];
    }
    // Email validation
    if (!email || email.trim().length === 0) {
        errors.email = ['Email is required'];
    }
    else if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.email = ['Please provide a valid email address'];
    }
    // Role validation
    if (!role || role.trim().length === 0) {
        errors.role = ['Role is required'];
    }
    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new error_1.AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }
    next();
};
exports.validateStaffCreate = validateStaffCreate;
const validateStaffLogin = (req, res, next) => {
    const { email, password } = req.body;
    const errors = {};
    // Email validation
    if (!email || email.trim().length === 0) {
        errors.email = ['Email is required'];
    }
    else if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.email = ['Please provide a valid email address'];
    }
    // Password validation
    if (!password || password.length === 0) {
        errors.password = ['Password is required'];
    }
    else if (password.length < 6) {
        errors.password = ['Password must be at least 6 characters'];
    }
    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new error_1.AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }
    next();
};
exports.validateStaffLogin = validateStaffLogin;
// Validate staff update
const validateStaffUpdate = (req, res, next) => {
    const { fullName, email } = req.body;
    const errors = {};
    // Full name validation (if provided)
    if (fullName !== undefined) {
        if (fullName.trim().length === 0) {
            errors.fullName = ['Full name cannot be empty'];
        }
        else if (fullName.length > 100) {
            errors.fullName = ['Full name cannot exceed 100 characters'];
        }
    }
    // Email validation (if provided)
    if (email !== undefined) {
        if (email.trim().length === 0) {
            errors.email = ['Email cannot be empty'];
        }
        else if (!/^\S+@\S+\.\S+$/.test(email)) {
            errors.email = ['Please provide a valid email address'];
        }
    }
    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new error_1.AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }
    next();
};
exports.validateStaffUpdate = validateStaffUpdate;
// Validate role assignment
const validateRoleAssignment = (req, res, next) => {
    const { roleId } = req.body;
    if (!roleId || roleId.trim().length === 0) {
        return next(new error_1.AppError('Role ID is required', 400, 'VALIDATION_ERROR'));
    }
    next();
};
exports.validateRoleAssignment = validateRoleAssignment;
//# sourceMappingURL=staffValidation.js.map