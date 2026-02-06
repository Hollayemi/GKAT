"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityLogs = exports.bulkDelete = exports.bulkSuspend = exports.resetPassword = exports.enableStaff = exports.disableStaff = exports.unsuspendStaff = exports.suspendStaff = exports.deleteStaff = exports.updateStaffRole = exports.updateStaff = exports.loginStaff = exports.createStaff = exports.getStaffById = exports.getAllStaff = void 0;
const Staff_model_1 = __importDefault(require("../../models/admin/Staff.model"));
const Roles_models_1 = __importDefault(require("../../models/admin/Roles.models"));
const Activitylog_model_1 = __importDefault(require("../../models/admin/Activitylog.model"));
const error_1 = require("../../middleware/error");
const email_1 = require("../../utils/email");
// Helper function to log activity
const logActivity = async (userId, userName, action, description, metadata, ipAddress) => {
    try {
        await Activitylog_model_1.default.create({
            userId,
            userName,
            action,
            description,
            metadata,
            timestamp: new Date(),
            ipAddress
        });
    }
    catch (error) {
        console.error('Failed to log activity:', error);
    }
};
const sendTokenResponse = (staff, statusCode, res, message) => {
    const token = staff.getSignedJwtToken();
    const refreshToken = staff.getRefreshToken();
    staff.save({ validateBeforeSave: false });
    const options = {
        expires: new Date(Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRE || '7') * 24 * 60 * 60 * 1000)),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };
    res
        .status(statusCode)
        .cookie('token', token, options)
        .data({
        user: {
            id: staff._id,
            name: staff.fullName,
            email: staff.email,
            role: staff.role,
            avatar: staff.avatar,
            region: staff.region,
            branch: staff.branch,
            status: staff.status,
            suspendedAt: staff.suspendedAt,
            suspendedUntil: staff.suspendedUntil,
        },
        token,
        refreshToken
    }, message, statusCode);
};
// @desc    Get all staff with filtering and pagination
// @route   GET /api/v1/staff
// @access  Private/Admin
exports.getAllStaff = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { search, status, role, page = 1, limit = 10 } = req.query;
    const query = {};
    // Search by name or email
    if (search) {
        query.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }
    // Filter by status
    if (status && typeof status === 'string') {
        query.status = status;
    }
    // Filter by role
    if (role) {
        query.role = role;
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const [staffList, total] = await Promise.all([
        Staff_model_1.default.find(query)
            .populate('role', 'name displayName')
            .populate('region', '_id name')
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Staff_model_1.default.countDocuments(query)
    ]);
    // Format response to match API spec
    const formattedStaff = staffList.map(staff => ({
        _id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role._id,
        roleName: staff.role.displayName,
        region: staff.region,
        branch: staff.branch,
        status: staff.status,
        avatar: staff.avatar,
        joinedDate: staff.joinedDate,
        lastLogin: staff.lastLogin,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt
    }));
    res.data({
        staffList: formattedStaff,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        }
    }, 'Staffs retrieved successfully', 200);
});
// @desc    Get single staff by ID
// @route   GET /api/v1/staff/:id
// @access  Private/Admin
exports.getStaffById = (0, error_1.asyncHandler)(async (req, res, next) => {
    console.log('Fetching staff with ID:', req.query.id || req.user?.id);
    const staff = await Staff_model_1.default.findById(req.query.id || req.user?.id)
        .populate('role', 'name displayName permissions')
        .select('-password')
        .lean();
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    // Combine role permissions with custom permissions
    const rolePermissions = staff.role.permissions || [];
    const allPermissions = [...new Set([...rolePermissions, ...staff.customPermissions])];
    const formattedStaff = {
        _id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role._id,
        roleName: staff.role.displayName,
        region: staff.region,
        branch: staff.branch,
        status: staff.status,
        avatar: staff.avatar,
        joinedDate: staff.joinedDate,
        lastLogin: staff.lastLogin,
        permissions: allPermissions,
        customPermissions: staff.customPermissions,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt
    };
    res.data(formattedStaff, 'Staff retrieved successfully');
});
// @desc    Create new staff member
// @route   POST /api/v1/staff
// @access  Private/Admin
exports.createStaff = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { fullName, email, phone, role, region, branch, permissions } = req.body;
    // Check if email already exists
    const existingStaff = await Staff_model_1.default.findOne({ email: email.toLowerCase() });
    if (existingStaff) {
        return next(new error_1.AppError('Email already exists', 400, 'DUPLICATE_EMAIL'));
    }
    // Verify role exists
    const roleDoc = await Roles_models_1.default.findById(role);
    if (!roleDoc) {
        return next(new error_1.AppError('Invalid role specified', 400, 'VALIDATION_ERROR'));
    }
    // Create staff member
    const staff = await Staff_model_1.default.create({
        fullName,
        email: email.toLowerCase(),
        phone,
        role,
        region,
        branch,
        customPermissions: permissions || [],
        status: 'active',
        passwordResetRequired: true
    });
    // Populate role for response
    await staff.populate('role', 'name displayName');
    // Send welcome email with temporary password
    try {
        await (0, email_1.sendEmail)({
            to: email,
            subject: 'Welcome to Go-Kart - Your Account Details',
            html: `
                <h2>Welcome to Go-Kart!</h2>
                <p>Hello ${fullName},</p>
                <p>Your account has been created. Here are your login details:</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Role:</strong> ${roleDoc.displayName}</p>
                <p>Please log in and change your password immediately.</p>
                <p>Login URL: ${process.env.FRONTEND_URL}/login</p>
            `
        });
    }
    catch (error) {
        console.error('Failed to send welcome email:', error);
    }
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Added New User', `Created new staff account: ${email}`, {
            newUserId: staff._id,
            newUserEmail: email,
            role: roleDoc.displayName
        }, req.ip);
    }
    const responseData = {
        _id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role._id,
        roleName: staff.role.displayName,
        region: staff.region,
        branch: staff.branch,
        status: staff.status,
        joinedDate: staff.joinedDate,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt
    };
    res.data(responseData, 'Staff member created successfully', 201);
});
// @desc    Login user with phone number and send OTP
// @route   POST /api/v1/auth/login
// @access  Public
exports.loginStaff = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email, password);
    if (!email) {
        return next(new error_1.AppError('Please provide email', 400));
    }
    // Find user by email
    const staff = await Staff_model_1.default.findOne({ email: email.toLowerCase() }).select('+password');
    if (!staff) {
        return next(new error_1.AppError('No staff found with this email', 404));
    }
    if (!password) {
        return next(new error_1.AppError('Please provide password for admin login', 400));
    }
    // Check if password is correct
    const isPasswordMatch = staff.comparePassword(password);
    if (!isPasswordMatch) {
        return next(new error_1.AppError('Invalid password', 401));
    }
    // For admin, send token immediately without OTP
    // (res as AppResponse).data(responseData, 'OTP sent successfully for login');
    sendTokenResponse(staff, 200, res, 'Admin login successful');
    return;
});
// @desc    Update staff member
// @route   PUT /api/v1/staff/:id
// @access  Private/Admin
exports.updateStaff = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { fullName, email, phone, role, region, branch } = req.body;
    const staff = await Staff_model_1.default.findById(req.params.id);
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    // Check if email is being changed and if it already exists
    if (email && email !== staff.email) {
        const existingStaff = await Staff_model_1.default.findOne({ email: email.toLowerCase() });
        if (existingStaff) {
            return next(new error_1.AppError('Email already exists', 400, 'DUPLICATE_EMAIL'));
        }
    }
    // Verify new role if being changed
    if (role && role !== staff.role.toString()) {
        const roleDoc = await Roles_models_1.default.findById(role);
        if (!roleDoc) {
            return next(new error_1.AppError('Invalid role specified', 400));
        }
    }
    // Update fields
    if (fullName)
        staff.fullName = fullName;
    if (email)
        staff.email = email.toLowerCase();
    if (phone !== undefined)
        staff.phone = phone;
    if (role)
        staff.role = role;
    if (region !== undefined)
        staff.region = region;
    if (branch !== undefined)
        staff.branch = branch;
    await staff.save();
    await staff.populate('role', 'name displayName');
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Updated Staff', `Updated staff member: ${staff.email}`, {
            staffId: staff._id,
            changes: req.body
        }, req.ip);
    }
    const responseData = {
        _id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role._id,
        roleName: staff.role.displayName,
        region: staff.region,
        branch: staff.branch,
        status: staff.status,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt
    };
    res.data(responseData, 'Staff member updated successfully');
});
// @desc    Update staff role and permissions
// @route   PUT /api/v1/staff/:id/role
// @access  Private/Admin
exports.updateStaffRole = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { roleId, permissions } = req.body;
    if (!roleId) {
        return next(new error_1.AppError('Role ID is required', 400));
    }
    const staff = await Staff_model_1.default.findById(req.params.id);
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    // Verify role exists
    const roleDoc = await Roles_models_1.default.findById(roleId);
    if (!roleDoc) {
        return next(new error_1.AppError('Invalid role specified', 400));
    }
    staff.role = roleId;
    if (permissions) {
        staff.customPermissions = permissions;
    }
    await staff.save();
    await staff.populate('role', 'name displayName permissions');
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Updated Role', `Changed role for ${staff.fullName} to ${roleDoc.displayName}`, {
            staffId: staff._id,
            newRole: roleDoc.displayName,
            newRoleId: roleId
        }, req.ip);
    }
    res.data({ staff }, 'Role and permissions updated successfully');
});
// @desc    Delete staff member
// @route   DELETE /api/v1/staff/:id
// @access  Private/Admin
exports.deleteStaff = (0, error_1.asyncHandler)(async (req, res, next) => {
    const staff = await Staff_model_1.default.findById(req.params.id);
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    // Prevent self-deletion
    if (req.user && staff._id.toString() === req.user.id) {
        return next(new error_1.AppError('You cannot delete your own account', 400));
    }
    await staff.deleteOne();
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Deleted Staff', `Deleted staff account: ${staff.email}`, {
            deletedStaffId: staff._id,
            deletedStaffEmail: staff.email
        }, req.ip);
    }
    res.success('Staff member deleted successfully');
});
// @desc    Suspend staff account
// @route   POST /api/v1/staff/:id/suspend
// @access  Private/Admin
exports.suspendStaff = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { reason, duration, notifyUser = true } = req.body;
    if (!reason) {
        return next(new error_1.AppError('Suspension reason is required', 400));
    }
    const staff = await Staff_model_1.default.findById(req.params.id);
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    // Prevent self-suspension
    if (req.user && staff._id.toString() === req.user.id) {
        return next(new error_1.AppError('You cannot suspend your own account', 400));
    }
    const now = new Date();
    staff.status = 'suspended';
    staff.suspendedAt = now;
    staff.suspensionReason = reason;
    if (duration) {
        const suspendedUntil = new Date(now);
        suspendedUntil.setDate(suspendedUntil.getDate() + duration);
        staff.suspendedUntil = suspendedUntil;
    }
    await staff.save();
    // Send notification email
    if (notifyUser) {
        try {
            await (0, email_1.sendEmail)({
                to: staff.email,
                subject: 'Account Suspended - Go-Kart',
                html: `
                    <h2>Account Suspension Notice</h2>
                    <p>Hello ${staff.fullName},</p>
                    <p>Your account has been suspended.</p>
                    <p><strong>Reason:</strong> ${reason}</p>
                    ${duration ? `<p><strong>Duration:</strong> ${duration} days</p>` : '<p><strong>Duration:</strong> Indefinite</p>'}
                    <p>If you believe this is an error, please contact your administrator.</p>
                `
            });
        }
        catch (error) {
            console.error('Failed to send suspension email:', error);
        }
    }
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Suspended Account', `Suspended account: ${staff.email}`, {
            staffId: staff._id,
            reason,
            duration
        }, req.ip);
    }
    const responseData = {
        _id: staff._id,
        status: staff.status,
        suspendedAt: staff.suspendedAt,
        suspendedUntil: staff.suspendedUntil,
        reason: staff.suspensionReason
    };
    res.data(responseData, 'Account suspended successfully');
});
// @desc    Unsuspend staff account
// @route   POST /api/v1/staff/:id/unsuspend
// @access  Private/Admin
exports.unsuspendStaff = (0, error_1.asyncHandler)(async (req, res, next) => {
    const staff = await Staff_model_1.default.findById(req.params.id);
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    if (staff.status !== 'suspended') {
        return next(new error_1.AppError('Staff account is not suspended', 400));
    }
    staff.status = 'active';
    staff.suspendedAt = undefined;
    staff.suspendedUntil = undefined;
    staff.suspensionReason = undefined;
    await staff.save();
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Unsuspended Account', `Unsuspended account: ${staff.email}`, {
            staffId: staff._id
        }, req.ip);
    }
    res.data({ staff }, 'Account unsuspended successfully');
});
// @desc    Disable staff account
// @route   POST /api/v1/staff/:id/disable
// @access  Private/Admin
exports.disableStaff = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { reason, notifyUser = true } = req.body;
    if (!reason) {
        return next(new error_1.AppError('Disablement reason is required', 400));
    }
    const staff = await Staff_model_1.default.findById(req.params.id);
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    // Prevent self-disablement
    if (req.user && staff._id.toString() === req.user.id) {
        return next(new error_1.AppError('You cannot disable your own account', 400));
    }
    staff.status = 'disabled';
    staff.disabledAt = new Date();
    staff.disablementReason = reason;
    await staff.save();
    // Send notification email
    if (notifyUser) {
        try {
            await (0, email_1.sendEmail)({
                to: staff.email,
                subject: 'Account Disabled - Go-Kart',
                html: `
                    <h2>Account Disabled</h2>
                    <p>Hello ${staff.fullName},</p>
                    <p>Your account has been permanently disabled.</p>
                    <p><strong>Reason:</strong> ${reason}</p>
                    <p>If you have questions, please contact your administrator.</p>
                `
            });
        }
        catch (error) {
            console.error('Failed to send disablement email:', error);
        }
    }
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Disabled Account', `Disabled account: ${staff.email}`, {
            staffId: staff._id,
            reason
        }, req.ip);
    }
    const responseData = {
        _id: staff._id,
        status: staff.status,
        disabledAt: staff.disabledAt,
        reason: staff.disablementReason
    };
    res.data(responseData, 'Account disabled successfully');
});
// @desc    Enable staff account
// @route   POST /api/v1/staff/:id/enable
// @access  Private/Admin
exports.enableStaff = (0, error_1.asyncHandler)(async (req, res, next) => {
    const staff = await Staff_model_1.default.findById(req.params.id);
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    if (staff.status !== 'disabled') {
        return next(new error_1.AppError('Staff account is not disabled', 400));
    }
    staff.status = 'active';
    staff.disabledAt = undefined;
    staff.disablementReason = undefined;
    await staff.save();
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Enabled Account', `Enabled account: ${staff.email}`, {
            staffId: staff._id
        }, req.ip);
    }
    res.data({ staff }, 'Account enabled successfully');
});
// @desc    Reset staff password
// @route   POST /api/v1/staff/:id/reset-password
// @access  Private/Admin
exports.resetPassword = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { notifyUser = true } = req.body;
    const staff = await Staff_model_1.default.findById(req.params.id);
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    // Generate temporary password
    const temporaryPassword = staff.generateTemporaryPassword();
    staff.password = temporaryPassword;
    staff.passwordResetRequired = true;
    await staff.save();
    // Send email with new password
    let emailSent = false;
    if (notifyUser) {
        try {
            await (0, email_1.sendEmail)({
                to: staff.email,
                subject: 'Password Reset - Go-Kart',
                html: `
                    <h2>Password Reset</h2>
                    <p>Hello ${staff.fullName},</p>
                    <p>Your password has been reset. Here is your new temporary password:</p>
                    <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
                    <p>Please log in and change your password immediately.</p>
                    <p>Login URL: ${process.env.FRONTEND_URL}/login</p>
                `
            });
            emailSent = true;
        }
        catch (error) {
            console.error('Failed to send password reset email:', error);
        }
    }
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Reset Password', `Reset password for: ${staff.email}`, {
            staffId: staff._id
        }, req.ip);
    }
    const responseData = {
        userId: staff._id,
        emailSent,
        ...(notifyUser ? {} : { temporaryPassword })
    };
    res.data(responseData, 'Password reset successfully');
});
// @desc    Bulk suspend staff
// @route   POST /api/v1/staff/bulk/suspend
// @access  Private/Admin
exports.bulkSuspend = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { ids, reason } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new error_1.AppError('Staff IDs array is required', 400));
    }
    if (!reason) {
        return next(new error_1.AppError('Suspension reason is required', 400));
    }
    // Prevent self-suspension
    if (req.user && ids.includes(req.user.id)) {
        return next(new error_1.AppError('You cannot suspend your own account', 400));
    }
    const now = new Date();
    const result = await Staff_model_1.default.updateMany({ _id: { $in: ids } }, {
        $set: {
            status: 'suspended',
            suspendedAt: now,
            suspensionReason: reason
        }
    });
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Bulk Suspend', `Suspended ${result.modifiedCount} staff accounts`, {
            staffIds: ids,
            reason,
            count: result.modifiedCount
        }, req.ip);
    }
    res.data({
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
    }, `${result.modifiedCount} staff member(s) suspended successfully`);
});
// @desc    Bulk delete staff
// @route   DELETE /api/v1/staff/bulk/delete
// @access  Private/Admin
exports.bulkDelete = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new error_1.AppError('Staff IDs array is required', 400));
    }
    // Prevent self-deletion
    if (req.user && ids.includes(req.user.id)) {
        return next(new error_1.AppError('You cannot delete your own account', 400));
    }
    const result = await Staff_model_1.default.deleteMany({ _id: { $in: ids } });
    // Log activity
    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Bulk Delete', `Deleted ${result.deletedCount} staff accounts`, {
            staffIds: ids,
            count: result.deletedCount
        }, req.ip);
    }
    res.data({
        deletedCount: result.deletedCount
    }, `${result.deletedCount} staff member(s) deleted successfully`);
});
// @desc    Get staff activity logs
// @route   GET /api/v1/staff/:id/activity-logs
// @access  Private/Admin
exports.getActivityLogs = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;
    const staff = await Staff_model_1.default.findById(req.params.id);
    if (!staff) {
        return next(new error_1.AppError('Staff member not found', 404));
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const [logs, total] = await Promise.all([
        Activitylog_model_1.default.find({ userId: req.params.id })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Activitylog_model_1.default.countDocuments({ userId: req.params.id })
    ]);
    res.data({ logs, pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        }
    }, 'Activity logs retrieved successfully', 200);
});
//# sourceMappingURL=staffController.js.map