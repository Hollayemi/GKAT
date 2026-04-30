/**
 * Staff controller — region-based updates:
 *  • getAllStaff: super_admin sees all; other roles see only staff in their region.
 *  • getStaffById, login, create, update, lifecycle methods are unchanged.
 */
import { Request, Response, NextFunction } from 'express';
import Staff, { IStaff } from '../../models/admin/Staff.model';
import Role from '../../models/admin/Roles.models';
import ActivityLog from '../../models/admin/Activitylog.model';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import { sendEmail } from '../../utils/email';
import { resolveStaffRegionId } from '../../helpers/regionScope';

//  helpers 

const logActivity = async (userId: string, userName: string, action: string, description: string, metadata?: any, ipAddress?: string) => {
    try {
        await ActivityLog.create({ userId, userName, action, description, metadata, timestamp: new Date(), ipAddress });
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
};

const sendTokenResponse = (staff: IStaff, statusCode: number, res: AppResponse, message: string) => {
    const token = staff.getSignedJwtToken();
    const refreshToken = staff.getRefreshToken();
    staff.save({ validateBeforeSave: false });

    const options = {
        expires: new Date(Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRE || '7') * 24 * 60 * 60 * 1000)),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    res.status(statusCode).cookie('token', token, options).data(
        { user: { id: staff._id, name: staff.fullName, email: staff.email, role: staff.role, avatar: staff.avatar, region: staff.region, branch: staff.branch, status: staff.status, suspendedAt: staff.suspendedAt, suspendedUntil: staff.suspendedUntil }, token, refreshToken },
        message, statusCode
    );
};

//  controllers 

// @desc    Get all staff — region-scoped for non-super-admin
// @route   GET /api/v1/staff
// @access  Private/Admin
export const getAllStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { search, status, role, page = 1, limit = 10 } = req.query;

    const query: any = {};

    //  Region scoping 
    const staffRegionId = await resolveStaffRegionId(req.user);

    if (staffRegionId) {
        // Match on region field — supports both ObjectId string and name string
        query.$or = [
            { region: staffRegionId.toString() },   // stored as ObjectId string
        ];
        // Also try the region name so legacy records are included
        const { default: Region } = require('../../models/config/region.model');
        const regionDoc = await Region.findById(staffRegionId).lean();
        if (regionDoc) {
            query.$or.push({ region: regionDoc.name });
        }
    }

    if (search) {
        const searchCond = { $or: [{ fullName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] };
        // Merge with existing $or if present
        if (query.$or) {
            query.$and = [{ $or: query.$or }, searchCond];
            delete query.$or;
        } else {
            Object.assign(query, searchCond);
        }
    }

    if (status && typeof status === 'string') query.status = status;
    if (role) query.role = role;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [staffList, total] = await Promise.all([
        Staff.find(query)
            .populate('role', 'name displayName')
            .populate('region', '_id name')
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Staff.countDocuments(query)
    ]);

    const formattedStaff = staffList.map(s => ({
        _id: s._id, fullName: s.fullName, email: s.email, phone: s.phone,
        role: (s.role as any)._id, roleName: (s.role as any).displayName,
        region: s.region, branch: s.branch, status: s.status, avatar: s.avatar,
        joinedDate: s.joinedDate, lastLogin: s.lastLogin, createdAt: s.createdAt, updatedAt: s.updatedAt
    }));

    (res as AppResponse).data(
        {
            staffList: formattedStaff,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
            scopedToRegion: staffRegionId ? staffRegionId.toString() : null,
        },
        'Staffs retrieved successfully',
        200
    );
});

// @desc    Get single staff by ID
// @route   GET /api/v1/staff/one
// @access  Private/Admin
export const getStaffById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const staff = await Staff.findById(req.query.id || req.user?.id)
        .populate('role', 'name displayName permissions')
        .select('-password')
        .lean();

    if (!staff) return next(new AppError('Staff member not found', 404));

    const rolePermissions = (staff.role as any).permissions || [];
    const allPermissions = [...new Set([...rolePermissions, ...staff.customPermissions])];

    (res as AppResponse).data({
        _id: staff._id, fullName: staff.fullName, email: staff.email, phone: staff.phone,
        role: (staff.role as any)._id, roleName: (staff.role as any).displayName,
        region: staff.region, branch: staff.branch, status: staff.status, avatar: staff.avatar,
        joinedDate: staff.joinedDate, lastLogin: staff.lastLogin,
        permissions: allPermissions, customPermissions: staff.customPermissions,
        createdAt: staff.createdAt, updatedAt: staff.updatedAt
    }, 'Staff retrieved successfully');
});

// @desc    Create new staff member
// @route   POST /api/v1/staff
// @access  Private/Admin
export const createStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fullName, email, phone, role, region, branch, permissions } = req.body;

    const existingStaff = await Staff.findOne({ email: email.toLowerCase() });
    if (existingStaff) return next(new AppError('Email already exists', 400, 'DUPLICATE_EMAIL'));

    const roleDoc = await Role.findById(role);
    if (!roleDoc) return next(new AppError('Invalid role specified', 400, 'VALIDATION_ERROR'));

    const staff = await Staff.create({ fullName, email: email.toLowerCase(), phone, role, region, branch, customPermissions: permissions || [], status: 'active', passwordResetRequired: true });
    await staff.populate('role', 'name displayName');

    try {
        await sendEmail({ to: email, subject: 'Welcome to Go-Kart - Your Account Details', html: `<h2>Welcome to Go-Kart!</h2><p>Hello ${fullName},</p><p>Your account has been created.</p><p><strong>Email:</strong> ${email}</p><p><strong>Role:</strong> ${roleDoc.displayName}</p><p>Please log in and change your password immediately.</p>` });
    } catch (error) { console.error('Failed to send welcome email:', error); }

    if (req.user) {
        await logActivity(req.user.id, req.user.fullName, 'Added New User', `Created new staff account: ${email}`, { newUserId: staff._id, newUserEmail: email, role: roleDoc.displayName }, req.ip);
    }

    (res as AppResponse).data({
        _id: staff._id, fullName: staff.fullName, email: staff.email, phone: staff.phone,
        role: (staff.role as any)._id, roleName: (staff.role as any).displayName,
        region: staff.region, branch: staff.branch, status: staff.status,
        joinedDate: staff.joinedDate, createdAt: staff.createdAt, updatedAt: staff.updatedAt
    }, 'Staff member created successfully', 201);
});

// @desc    Login staff
// @route   POST /api/v1/staff/login
// @access  Public
export const loginStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    if (!email) return next(new AppError('Please provide email', 400));

    const staff = await Staff.findOne({ email: email.toLowerCase() }).select('+password');
    if (!staff) return next(new AppError('No staff found with this email', 404));
    if (!password) return next(new AppError('Please provide password', 400));

    const isPasswordMatch = staff.comparePassword(password);
    if (!isPasswordMatch) return next(new AppError('Invalid password', 401));

    sendTokenResponse(staff, 200, res as AppResponse, 'Admin login successful');
});

// @desc    Update staff member
// @route   PUT /api/v1/staff/:id
// @access  Private/Admin
export const updateStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fullName, email, phone, role, region, branch } = req.body;
    const staff = await Staff.findById(req.params.id);
    if (!staff) return next(new AppError('Staff member not found', 404));

    if (email && email !== staff.email) {
        const existingStaff = await Staff.findOne({ email: email.toLowerCase() });
        if (existingStaff) return next(new AppError('Email already exists', 400, 'DUPLICATE_EMAIL'));
    }
    if (role && role !== staff.role.toString()) {
        const roleDoc = await Role.findById(role);
        if (!roleDoc) return next(new AppError('Invalid role specified', 400));
    }

    if (fullName) staff.fullName = fullName;
    if (email) staff.email = email.toLowerCase();
    if (phone !== undefined) staff.phone = phone;
    if (role) staff.role = role;
    if (region !== undefined) staff.region = region;
    if (branch !== undefined) staff.branch = branch;

    await staff.save();
    await staff.populate('role', 'name displayName');

    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Updated Staff', `Updated staff member: ${staff.email}`, { staffId: staff._id, changes: req.body }, req.ip);

    (res as AppResponse).data({
        _id: staff._id, fullName: staff.fullName, email: staff.email, phone: staff.phone,
        role: (staff.role as any)._id, roleName: (staff.role as any).displayName,
        region: staff.region, branch: staff.branch, status: staff.status,
        createdAt: staff.createdAt, updatedAt: staff.updatedAt
    }, 'Staff member updated successfully');
});

// @desc    Update staff role and permissions
// @route   PUT /api/v1/staff/:id/role
// @access  Private/Admin
export const updateStaffRole = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { roleId, permissions } = req.body;
    if (!roleId) return next(new AppError('Role ID is required', 400));
    const staff = await Staff.findById(req.params.id);
    if (!staff) return next(new AppError('Staff member not found', 404));
    const roleDoc = await Role.findById(roleId);
    if (!roleDoc) return next(new AppError('Invalid role specified', 400));
    staff.role = roleId;
    if (permissions) staff.customPermissions = permissions;
    await staff.save();
    await staff.populate('role', 'name displayName permissions');
    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Updated Role', `Changed role for ${staff.fullName} to ${roleDoc.displayName}`, { staffId: staff._id, newRole: roleDoc.displayName, newRoleId: roleId }, req.ip);
    (res as AppResponse).data({ staff }, 'Role and permissions updated successfully');
});

// @desc    Delete staff member
// @route   DELETE /api/v1/staff/:id
// @access  Private/Admin
export const deleteStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return next(new AppError('Staff member not found', 404));
    if (req.user && staff._id.toString() === req.user.id) return next(new AppError('You cannot delete your own account', 400));
    await staff.deleteOne();
    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Deleted Staff', `Deleted staff account: ${staff.email}`, { deletedStaffId: staff._id, deletedStaffEmail: staff.email }, req.ip);
    (res as AppResponse).success('Staff member deleted successfully');
});

// @desc    Suspend staff account
// @route   POST /api/v1/staff/:id/suspend
// @access  Private/Admin
export const suspendStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { reason, duration, notifyUser = true } = req.body;
    if (!reason) return next(new AppError('Suspension reason is required', 400));
    const staff = await Staff.findById(req.params.id);
    if (!staff) return next(new AppError('Staff member not found', 404));
    if (req.user && staff._id.toString() === req.user.id) return next(new AppError('You cannot suspend your own account', 400));

    const now = new Date();
    staff.status = 'suspended';
    staff.suspendedAt = now;
    staff.suspensionReason = reason;
    if (duration) { const until = new Date(now); until.setDate(until.getDate() + duration); staff.suspendedUntil = until; }
    await staff.save();

    if (notifyUser) { try { await sendEmail({ to: staff.email, subject: 'Account Suspended - Go-Kart', html: `<h2>Account Suspension Notice</h2><p>Hello ${staff.fullName},</p><p>Your account has been suspended.</p><p><strong>Reason:</strong> ${reason}</p>` }); } catch (e) { console.error(e); } }
    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Suspended Account', `Suspended account: ${staff.email}`, { staffId: staff._id, reason, duration }, req.ip);

    (res as AppResponse).data({ _id: staff._id, status: staff.status, suspendedAt: staff.suspendedAt, suspendedUntil: staff.suspendedUntil, reason: staff.suspensionReason }, 'Account suspended successfully');
});

// @desc    Unsuspend staff account
// @route   POST /api/v1/staff/:id/unsuspend
// @access  Private/Admin
export const unsuspendStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return next(new AppError('Staff member not found', 404));
    if (staff.status !== 'suspended') return next(new AppError('Staff account is not suspended', 400));
    staff.status = 'active'; staff.suspendedAt = undefined; staff.suspendedUntil = undefined; staff.suspensionReason = undefined;
    await staff.save();
    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Unsuspended Account', `Unsuspended account: ${staff.email}`, { staffId: staff._id }, req.ip);
    (res as AppResponse).data({ staff }, 'Account unsuspended successfully');
});

// @desc    Disable staff account
// @route   POST /api/v1/staff/:id/disable
// @access  Private/Admin
export const disableStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { reason, notifyUser = true } = req.body;
    if (!reason) return next(new AppError('Disablement reason is required', 400));
    const staff = await Staff.findById(req.params.id);
    if (!staff) return next(new AppError('Staff member not found', 404));
    if (req.user && staff._id.toString() === req.user.id) return next(new AppError('You cannot disable your own account', 400));
    staff.status = 'disabled'; staff.disabledAt = new Date(); staff.disablementReason = reason;
    await staff.save();
    if (notifyUser) { try { await sendEmail({ to: staff.email, subject: 'Account Disabled - Go-Kart', html: `<h2>Account Disabled</h2><p>Hello ${staff.fullName},</p><p>Your account has been permanently disabled.</p><p><strong>Reason:</strong> ${reason}</p>` }); } catch (e) { console.error(e); } }
    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Disabled Account', `Disabled account: ${staff.email}`, { staffId: staff._id, reason }, req.ip);
    (res as AppResponse).data({ _id: staff._id, status: staff.status, disabledAt: staff.disabledAt, reason: staff.disablementReason }, 'Account disabled successfully');
});

// @desc    Enable staff account
// @route   POST /api/v1/staff/:id/enable
// @access  Private/Admin
export const enableStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return next(new AppError('Staff member not found', 404));
    if (staff.status !== 'disabled') return next(new AppError('Staff account is not disabled', 400));
    staff.status = 'active'; staff.disabledAt = undefined; staff.disablementReason = undefined;
    await staff.save();
    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Enabled Account', `Enabled account: ${staff.email}`, { staffId: staff._id }, req.ip);
    (res as AppResponse).data({ staff }, 'Account enabled successfully');
});

// @desc    Reset staff password
// @route   POST /api/v1/staff/:id/reset-password
// @access  Private/Admin
export const resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { notifyUser = true } = req.body;
    const staff = await Staff.findById(req.params.id);
    if (!staff) return next(new AppError('Staff member not found', 404));
    const temporaryPassword = staff.generateTemporaryPassword();
    staff.password = temporaryPassword; staff.passwordResetRequired = true;
    await staff.save();
    let emailSent = false;
    if (notifyUser) { try { await sendEmail({ to: staff.email, subject: 'Password Reset - Go-Kart', html: `<h2>Password Reset</h2><p>Your new temporary password:</p><p><strong>${temporaryPassword}</strong></p>` }); emailSent = true; } catch (e) { console.error(e); } }
    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Reset Password', `Reset password for: ${staff.email}`, { staffId: staff._id }, req.ip);
    (res as AppResponse).data({ userId: staff._id, emailSent, ...(notifyUser ? {} : { temporaryPassword }) }, 'Password reset successfully');
});

// @desc    Bulk suspend staff
// @route   POST /api/v1/staff/bulk/suspend
// @access  Private/Admin
export const bulkSuspend = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { ids, reason } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return next(new AppError('Staff IDs array is required', 400));
    if (!reason) return next(new AppError('Suspension reason is required', 400));
    if (req.user && ids.includes(req.user.id)) return next(new AppError('You cannot suspend your own account', 400));
    const now = new Date();
    const result = await Staff.updateMany({ _id: { $in: ids } }, { $set: { status: 'suspended', suspendedAt: now, suspensionReason: reason } });
    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Bulk Suspend', `Suspended ${result.modifiedCount} staff accounts`, { staffIds: ids, reason, count: result.modifiedCount }, req.ip);
    (res as AppResponse).data({ modifiedCount: result.modifiedCount, matchedCount: result.matchedCount }, `${result.modifiedCount} staff member(s) suspended successfully`);
});

// @desc    Bulk delete staff
// @route   DELETE /api/v1/staff/bulk/delete
// @access  Private/Admin
export const bulkDelete = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return next(new AppError('Staff IDs array is required', 400));
    if (req.user && ids.includes(req.user.id)) return next(new AppError('You cannot delete your own account', 400));
    const result = await Staff.deleteMany({ _id: { $in: ids } });
    if (req.user) await logActivity(req.user.id, req.user.fullName, 'Bulk Delete', `Deleted ${result.deletedCount} staff accounts`, { staffIds: ids, count: result.deletedCount }, req.ip);
    (res as AppResponse).data({ deletedCount: result.deletedCount }, `${result.deletedCount} staff member(s) deleted successfully`);
});

// @desc    Get staff activity logs
// @route   GET /api/v1/staff/:id/activity-logs
// @access  Private/Admin
export const getActivityLogs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 20 } = req.query;
    const staff = await Staff.findById(req.params.id);
    if (!staff) return next(new AppError('Staff member not found', 404));
    const pageNum = parseInt(page as string); const limitNum = parseInt(limit as string); const skip = (pageNum - 1) * limitNum;
    const [logs, total] = await Promise.all([
        ActivityLog.find({ userId: req.params.id }).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean(),
        ActivityLog.countDocuments({ userId: req.params.id })
    ]);
    (res as AppResponse).data({ logs, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } }, 'Activity logs retrieved successfully', 200);
});
