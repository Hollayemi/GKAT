"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkOwnerOrPermission = exports.authorize = exports.checkAnyPermission = exports.checkPermissions = exports.checkPermission = exports.protect = exports.ifToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Staff_model_1 = __importDefault(require("../models/admin/Staff.model"));
const User_1 = __importDefault(require("../models/User"));
const error_1 = require("./error");
// Protect routes - verify JWT token
exports.ifToken = (0, error_1.asyncHandler)(async (req, res, next) => {
    let token;
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    else if (req.cookies?.token) {
        token = req.cookies.token;
    }
    if (!token) {
        return next();
    }
    try {
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await User_1.default.findById(decoded.id);
        req.user = user;
        return next();
    }
    catch (error) {
        return next(new error_1.AppError('--Not authorized to access this route', 401, 'UNAUTHORIZED'));
    }
});
// Protect routes - verify JWT token
exports.protect = (0, error_1.asyncHandler)(async (req, res, next) => {
    let token;
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    else if (req.cookies?.token) {
        token = req.cookies.token;
    }
    if (!token) {
        return next(new error_1.AppError('-Not authorized to access this route', 401, 'UNAUTHORIZED'));
    }
    try {
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        console.log({ decoded });
        if (decoded.role === 'user' || decoded.role === 'driver') {
            const user = await User_1.default.findById(decoded.id);
            if (!user) {
                return next(new error_1.AppError('User no longer exists', 401));
            }
            if (!user.isPhoneVerified) {
                return next(new error_1.AppError('Please verify your phone number', 401));
            }
            req.user = user;
            return next();
        }
        // Get user from token
        const staff = await Staff_model_1.default.findById(decoded.id)
            .populate('role', 'name displayName permissions')
            .select('-password');
        if (!staff) {
            return next(new error_1.AppError('User no longer exists', 401, 'UNAUTHORIZED'));
        }
        // Check if account is active
        if (staff.status === 'suspended') {
            return next(new error_1.AppError('Account is suspended', 403, 'FORBIDDEN'));
        }
        if (staff.status === 'disabled') {
            return next(new error_1.AppError('Account is disabled', 403, 'FORBIDDEN'));
        }
        // Check if suspension has expired
        if (staff.status !== 'active' && staff.suspendedUntil) {
            if (new Date() > staff.suspendedUntil) {
                staff.status = 'active';
                staff.suspendedAt = undefined;
                staff.suspendedUntil = undefined;
                staff.suspensionReason = undefined;
                await staff.save();
            }
        }
        // Combine role permissions with custom permissions
        const rolePermissions = staff.role.permissions || [];
        const allPermissions = [...new Set([...rolePermissions, ...staff.customPermissions])];
        // Add user to request
        const staffWithPermissions = {
            ...staff.toObject(),
            permissions: allPermissions
        };
        // req.user.isAdmin = true
        req.user = staffWithPermissions;
        next();
    }
    catch (error) {
        return next(new error_1.AppError('--Not authorized to access this route', 401, 'UNAUTHORIZED'));
    }
});
// Check for specific permission
const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new error_1.AppError('Not authenticated', 401, 'UNAUTHORIZED'));
        }
        if (!req.user.permissions.includes(permission)) {
            return next(new error_1.AppError(`You do not have permission to perform this action. Required permission: ${permission}`, 403, 'FORBIDDEN'));
        }
        next();
    };
};
exports.checkPermission = checkPermission;
// Check for multiple permissions (user must have ALL)
const checkPermissions = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new error_1.AppError('Not authenticated', 401, 'UNAUTHORIZED'));
        }
        const hasAllPermissions = permissions.every(permission => req.user.permissions.includes(permission));
        if (!hasAllPermissions) {
            return next(new error_1.AppError(`You do not have all required permissions. Required: ${permissions.join(', ')}`, 403, 'FORBIDDEN'));
        }
        next();
    };
};
exports.checkPermissions = checkPermissions;
// Check for any of multiple permissions (user must have AT LEAST ONE)
const checkAnyPermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new error_1.AppError('Not authenticated', 401, 'UNAUTHORIZED'));
        }
        const hasAnyPermission = permissions.some(permission => req.user.permissions.includes(permission));
        if (!hasAnyPermission) {
            return next(new error_1.AppError(`You do not have any of the required permissions. Required one of: ${permissions.join(', ')}`, 403, 'FORBIDDEN'));
        }
        next();
    };
};
exports.checkAnyPermission = checkAnyPermission;
// Authorize based on role (legacy - prefer permission-based)
const authorize = (...roles) => {
    return async (req, res, next) => {
        if (!req.user) {
            return next(new error_1.AppError('Not authenticated', 401, 'UNAUTHORIZED'));
        }
        const staff = await Staff_model_1.default.findById(req.user.id).populate('role', 'name');
        if (!staff) {
            return next(new error_1.AppError('User not found', 404));
        }
        const roleName = staff.role.name;
        // if (!roles.includes(roleName)) {
        //     return next(new AppError(
        //         `User role '${roleName}' is not authorized to access this route`,
        //         403,
        //         'FORBIDDEN'
        //     ));
        // }
        next();
    };
};
exports.authorize = authorize;
// Check if user is the owner of a resource or has permission
const checkOwnerOrPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new error_1.AppError('Not authenticated', 401, 'UNAUTHORIZED'));
        }
        // Allow if user has the permission
        if (req.user.permissions.includes(permission)) {
            return next();
        }
        // Allow if user is the owner (ID matches)
        if (req.params.id === req.user.id) {
            return next();
        }
        return next(new error_1.AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
    };
};
exports.checkOwnerOrPermission = checkOwnerOrPermission;
//# sourceMappingURL=auth.js.map