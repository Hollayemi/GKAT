import { Request, Response, NextFunction } from 'express';
import Staff, { IStaff } from '../../models/admin/Staff.model';
import Role from '../../models/admin/Roles.models';
import ActivityLog, { FeedParams } from '../../models/admin/Activitylog.model';
import { ACTIONS } from '../../models/admin/Activitylog.model';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import { sendEmail } from '../../utils/email';
import { resolveStaffRegionId } from '../../helpers/regionScope';
import { logActivity } from '../../utils/activityLogger';

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

const sendTokenResponse = (
  staff: IStaff,
  statusCode: number,
  res: AppResponse,
  message: string
) => {
  const token        = staff.getSignedJwtToken();
  const refreshToken = staff.getRefreshToken();
  staff.save({ validateBeforeSave: false });

  const options = {
    expires: new Date(
      Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRE || '7') * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  };

  res.status(statusCode).cookie('token', token, options).data(
    {
      user: {
        id: staff._id, name: staff.fullName, email: staff.email,
        role: staff.role, avatar: staff.avatar, region: staff.region,
        branch: staff.branch, status: staff.status,
        suspendedAt: staff.suspendedAt, suspendedUntil: staff.suspendedUntil,
      },
      token,
      refreshToken,
    },
    message,
    statusCode
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export const getAllStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { search, status, role, page = 1, limit = 10 } = req.query;

  const query: any = {};
  const staffRegionId = await resolveStaffRegionId(req.user);

  if (staffRegionId) {
    query.$or = [{ region: staffRegionId.toString() }];
    const { default: Region } = require('../../models/config/region.model');
    const regionDoc = await Region.findById(staffRegionId).lean();
    if (regionDoc) query.$or.push({ region: regionDoc.name });
  }

  if (search) {
    const searchCond = {
      $or: [
        { fullName: { $regex: search, $options: 'i' } },
        { email:    { $regex: search, $options: 'i' } },
      ],
    };
    if (query.$or) {
      query.$and = [{ $or: query.$or }, searchCond];
      delete query.$or;
    } else {
      Object.assign(query, searchCond);
    }
  }

  if (status && typeof status === 'string') query.status = status;
  if (role) query.role = role;

  const pageNum  = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip     = (pageNum - 1) * limitNum;

  const [staffList, total] = await Promise.all([
    Staff.find(query)
      .populate('role', 'name displayName')
      .populate('region', '_id name')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Staff.countDocuments(query),
  ]);

  const formattedStaff = staffList.map((s) => ({
    _id: s._id, fullName: s.fullName, email: s.email, phone: s.phone,
    role: (s.role as any)._id, roleName: (s.role as any).displayName,
    region: s.region, branch: s.branch, status: s.status, avatar: s.avatar,
    joinedDate: s.joinedDate, lastLogin: s.lastLogin,
    createdAt: s.createdAt, updatedAt: s.updatedAt,
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

export const getStaffById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const staff = await Staff.findById(req.query.id || req.user?.id)
    .populate('role', 'name displayName permissions')
    .select('-password')
    .lean();

  if (!staff) return next(new AppError('Staff member not found', 404));

  const rolePermissions  = (staff.role as any).permissions || [];
  const allPermissions   = [...new Set([...rolePermissions, ...staff.customPermissions])];

  (res as AppResponse).data(
    {
      _id: staff._id, fullName: staff.fullName, email: staff.email, phone: staff.phone,
      role: (staff.role as any)._id, roleName: (staff.role as any).displayName,
      region: staff.region, branch: staff.branch, status: staff.status, avatar: staff.avatar,
      joinedDate: staff.joinedDate, lastLogin: staff.lastLogin,
      permissions: allPermissions, customPermissions: staff.customPermissions,
      createdAt: staff.createdAt, updatedAt: staff.updatedAt,
    },
    'Staff retrieved successfully'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export const loginStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  if (!email)    return next(new AppError('Please provide email', 400));

  const staff = await Staff.findOne({ email: email.toLowerCase() }).select('+password');

  // --- Failed login ---
  if (!staff) {
    // Log attempted-but-not-found (no actorId available – use a placeholder)
    // We skip structured logging here since there is no valid actor.
    return next(new AppError('No staff found with this email', 404));
  }

  if (!password) return next(new AppError('Please provide password', 400));

  const isPasswordMatch = staff.comparePassword(password);

  if (!isPasswordMatch) {
    // Inject a temporary user onto req so logActivity can read actor info
    ;(req as any).user = {
      id:       staff._id.toString(),
      fullName: staff.fullName,
      email:    staff.email,
    };
    await logActivity(req, {
      action:      ACTIONS.LOGIN_FAILED,
      description: `Failed login attempt for ${staff.email}`,
      targetId:    staff._id.toString(),
      targetType:  'Staff',
      targetName:  staff.fullName,
    });
    return next(new AppError('Invalid password', 401));
  }

  // --- Successful login ---
  ;(req as any).user = {
    id:       staff._id.toString(),
    fullName: staff.fullName,
    email:    staff.email,
    role:     staff.role,
  };
  await logActivity(req, {
    action:      ACTIONS.LOGIN,
    description: `${staff.fullName} logged in successfully`,
    targetId:    staff._id.toString(),
    targetType:  'Staff',
    targetName:  staff.fullName,
  });

  sendTokenResponse(staff, 200, res as AppResponse, 'Admin login successful');
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export const createStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { fullName, email, phone, role, region, branch, permissions } = req.body;

  const existingStaff = await Staff.findOne({ email: email.toLowerCase() });
  if (existingStaff) return next(new AppError('Email already exists', 400, 'DUPLICATE_EMAIL'));

  const roleDoc = await Role.findById(role);
  if (!roleDoc) return next(new AppError('Invalid role specified', 400, 'VALIDATION_ERROR'));

  const staff = await Staff.create({
    fullName, email: email.toLowerCase(), phone, role, region, branch,
    customPermissions: permissions || [], status: 'active', passwordResetRequired: true,
  });
  await staff.populate('role', 'name displayName');

  try {
    await sendEmail({
      to: email,
      subject: 'Welcome to Go-Kart - Your Account Details',
      html: `<h2>Welcome to Go-Kart!</h2><p>Hello ${fullName},</p>
             <p>Your account has been created.</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Role:</strong> ${roleDoc.displayName}</p>
             <p>Please log in and change your password immediately.</p>`,
    });
  } catch (err) {
    console.error('Failed to send welcome email:', err);
  }

  await logActivity(req, {
    action:      ACTIONS.STAFF_CREATED,
    description: `Created new staff account for ${fullName} (${email}) with role "${roleDoc.displayName}"`,
    targetId:    staff._id.toString(),
    targetType:  'Staff',
    targetName:  fullName,
    after:       { email, role: roleDoc.displayName, region, branch },
    metadata:    { roleId: role, roleDisplay: roleDoc.displayName },
  });

  (res as AppResponse).data(
    {
      _id: staff._id, fullName: staff.fullName, email: staff.email, phone: staff.phone,
      role: (staff.role as any)._id, roleName: (staff.role as any).displayName,
      region: staff.region, branch: staff.branch, status: staff.status,
      joinedDate: staff.joinedDate, createdAt: staff.createdAt, updatedAt: staff.updatedAt,
    },
    'Staff member created successfully',
    201
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export const updateStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { fullName, email, phone, role, region, branch } = req.body;

  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  // Capture snapshot before mutation
  const before = {
    fullName: staff.fullName, email: staff.email, phone: staff.phone,
    role: staff.role?.toString(), region: staff.region, branch: staff.branch,
  };

  if (email && email !== staff.email) {
    const existing = await Staff.findOne({ email: email.toLowerCase() });
    if (existing) return next(new AppError('Email already exists', 400, 'DUPLICATE_EMAIL'));
  }
  if (role && role !== staff.role.toString()) {
    const roleDoc = await Role.findById(role);
    if (!roleDoc) return next(new AppError('Invalid role specified', 400));
  }

  if (fullName)          staff.fullName = fullName;
  if (email)             staff.email    = email.toLowerCase();
  if (phone !== undefined) staff.phone  = phone;
  if (role)              staff.role     = role;
  if (region !== undefined) staff.region = region;
  if (branch !== undefined) staff.branch = branch;

  await staff.save();
  await staff.populate('role', 'name displayName');

  const after = {
    fullName: staff.fullName, email: staff.email, phone: staff.phone,
    role: staff.role?.toString(), region: staff.region, branch: staff.branch,
  };

  await logActivity(req, {
    action:      ACTIONS.STAFF_UPDATED,
    description: `Updated profile for staff member ${staff.fullName} (${staff.email})`,
    targetId:    staff._id.toString(),
    targetType:  'Staff',
    targetName:  staff.fullName,
    before,
    after,
  });

  (res as AppResponse).data(
    {
      _id: staff._id, fullName: staff.fullName, email: staff.email, phone: staff.phone,
      role: (staff.role as any)._id, roleName: (staff.role as any).displayName,
      region: staff.region, branch: staff.branch, status: staff.status,
      createdAt: staff.createdAt, updatedAt: staff.updatedAt,
    },
    'Staff member updated successfully'
  );
});

export const updateStaffRole = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { roleId, permissions } = req.body;
  if (!roleId) return next(new AppError('Role ID is required', 400));

  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  const roleDoc = await Role.findById(roleId);
  if (!roleDoc) return next(new AppError('Invalid role specified', 400));

  const previousRole = staff.role?.toString();

  staff.role = roleId;
  if (permissions) staff.customPermissions = permissions;
  await staff.save();
  await staff.populate('role', 'name displayName permissions');

  await logActivity(req, {
    action:      ACTIONS.STAFF_ROLE_UPDATED,
    description: `Changed role for ${staff.fullName} from "${previousRole}" to "${roleDoc.displayName}"`,
    targetId:    staff._id.toString(),
    targetType:  'Staff',
    targetName:  staff.fullName,
    before:      { role: previousRole },
    after:       { role: roleId, roleDisplay: roleDoc.displayName, permissions },
    metadata:    { newRoleId: roleId, newRoleDisplay: roleDoc.displayName },
  });

  (res as AppResponse).data({ staff }, 'Role and permissions updated successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export const deleteStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  if (req.user && staff._id.toString() === req.user.id)
    return next(new AppError('You cannot delete your own account', 400));

  const snapshot = {
    fullName: staff.fullName, email: staff.email,
    role: staff.role?.toString(), region: staff.region,
  };

  await staff.deleteOne();

  await logActivity(req, {
    action:      ACTIONS.STAFF_DELETED,
    description: `Permanently deleted staff account for ${snapshot.fullName} (${snapshot.email})`,
    targetId:    req.params.id,
    targetType:  'Staff',
    targetName:  snapshot.fullName,
    before:      snapshot,
    metadata:    { deletedEmail: snapshot.email },
  });

  (res as AppResponse).success('Staff member deleted successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUSPEND / UNSUSPEND
// ─────────────────────────────────────────────────────────────────────────────

export const suspendStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { reason, duration, notifyUser = true } = req.body;
  if (!reason) return next(new AppError('Suspension reason is required', 400));

  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  if (req.user && staff._id.toString() === req.user.id)
    return next(new AppError('You cannot suspend your own account', 400));

  const now = new Date();
  staff.status         = 'suspended';
  staff.suspendedAt    = now;
  staff.suspensionReason = reason;

  let suspendedUntil: Date | undefined;
  if (duration) {
    suspendedUntil = new Date(now);
    suspendedUntil.setDate(suspendedUntil.getDate() + duration);
    staff.suspendedUntil = suspendedUntil;
  }
  await staff.save();

  if (notifyUser) {
    try {
      await sendEmail({
        to: staff.email,
        subject: 'Account Suspended - Go-Kart',
        html: `<h2>Account Suspension Notice</h2>
               <p>Hello ${staff.fullName},</p>
               <p>Your account has been suspended.</p>
               <p><strong>Reason:</strong> ${reason}</p>`,
      });
    } catch (err) { console.error(err); }
  }

  await logActivity(req, {
    action:      ACTIONS.STAFF_SUSPENDED,
    description: `Suspended account for ${staff.fullName} (${staff.email}). Reason: "${reason}"${duration ? `. Duration: ${duration} day(s)` : ''}`,
    targetId:    staff._id.toString(),
    targetType:  'Staff',
    targetName:  staff.fullName,
    metadata:    { reason, duration, suspendedUntil, notifyUser },
  });

  (res as AppResponse).data(
    {
      _id: staff._id, status: staff.status,
      suspendedAt: staff.suspendedAt, suspendedUntil: staff.suspendedUntil,
      reason: staff.suspensionReason,
    },
    'Account suspended successfully'
  );
});

export const unsuspendStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));
  if (staff.status !== 'suspended') return next(new AppError('Staff account is not suspended', 400));

  const previousReason = staff.suspensionReason;
  staff.status              = 'active';
  staff.suspendedAt         = undefined;
  staff.suspendedUntil      = undefined;
  staff.suspensionReason    = undefined;
  await staff.save();

  await logActivity(req, {
    action:      ACTIONS.STAFF_UNSUSPENDED,
    description: `Unsuspended account for ${staff.fullName} (${staff.email})`,
    targetId:    staff._id.toString(),
    targetType:  'Staff',
    targetName:  staff.fullName,
    metadata:    { previousSuspensionReason: previousReason },
  });

  (res as AppResponse).data({ staff }, 'Account unsuspended successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// DISABLE / ENABLE
// ─────────────────────────────────────────────────────────────────────────────

export const disableStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { reason, notifyUser = true } = req.body;
  if (!reason) return next(new AppError('Disablement reason is required', 400));

  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  if (req.user && staff._id.toString() === req.user.id)
    return next(new AppError('You cannot disable your own account', 400));

  staff.status            = 'disabled';
  staff.disabledAt        = new Date();
  staff.disablementReason = reason;
  await staff.save();

  if (notifyUser) {
    try {
      await sendEmail({
        to: staff.email,
        subject: 'Account Disabled - Go-Kart',
        html: `<h2>Account Disabled</h2>
               <p>Hello ${staff.fullName},</p>
               <p>Your account has been permanently disabled.</p>
               <p><strong>Reason:</strong> ${reason}</p>`,
      });
    } catch (err) { console.error(err); }
  }

  await logActivity(req, {
    action:      ACTIONS.STAFF_DISABLED,
    description: `Permanently disabled account for ${staff.fullName} (${staff.email}). Reason: "${reason}"`,
    targetId:    staff._id.toString(),
    targetType:  'Staff',
    targetName:  staff.fullName,
    metadata:    { reason, notifyUser },
  });

  (res as AppResponse).data(
    { _id: staff._id, status: staff.status, disabledAt: staff.disabledAt, reason: staff.disablementReason },
    'Account disabled successfully'
  );
});

export const enableStaff = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));
  if (staff.status !== 'disabled') return next(new AppError('Staff account is not disabled', 400));

  const previousReason = staff.disablementReason;
  staff.status             = 'active';
  staff.disabledAt         = undefined;
  staff.disablementReason  = undefined;
  await staff.save();

  await logActivity(req, {
    action:      ACTIONS.STAFF_ENABLED,
    description: `Re-enabled account for ${staff.fullName} (${staff.email})`,
    targetId:    staff._id.toString(),
    targetType:  'Staff',
    targetName:  staff.fullName,
    metadata:    { previousDisablementReason: previousReason },
  });

  (res as AppResponse).data({ staff }, 'Account enabled successfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET
// ─────────────────────────────────────────────────────────────────────────────

export const resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { notifyUser = true } = req.body;

  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  const temporaryPassword = staff.generateTemporaryPassword();
  staff.password              = temporaryPassword;
  staff.passwordResetRequired = true;
  await staff.save();

  let emailSent = false;
  if (notifyUser) {
    try {
      await sendEmail({
        to: staff.email,
        subject: 'Password Reset - Go-Kart',
        html: `<h2>Password Reset</h2>
               <p>Your new temporary password:</p>
               <p><strong>${temporaryPassword}</strong></p>`,
      });
      emailSent = true;
    } catch (err) { console.error(err); }
  }

  await logActivity(req, {
    action:      ACTIONS.PASSWORD_RESET,
    description: `Admin-triggered password reset for ${staff.fullName} (${staff.email})`,
    targetId:    staff._id.toString(),
    targetType:  'Staff',
    targetName:  staff.fullName,
    metadata:    { emailSent, notifyUser },
  });

  (res as AppResponse).data(
    { userId: staff._id, emailSent, ...(notifyUser ? {} : { temporaryPassword }) },
    'Password reset successfully'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BULK OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const bulkSuspend = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { ids, reason } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0)
    return next(new AppError('Staff IDs array is required', 400));
  if (!reason) return next(new AppError('Suspension reason is required', 400));
  if (req.user && ids.includes(req.user.id))
    return next(new AppError('You cannot suspend your own account', 400));

  const now    = new Date();
  const result = await Staff.updateMany(
    { _id: { $in: ids } },
    { $set: { status: 'suspended', suspendedAt: now, suspensionReason: reason } }
  );

  await logActivity(req, {
    action:      ACTIONS.STAFF_BULK_SUSPENDED,
    description: `Bulk-suspended ${result.modifiedCount} staff account(s). Reason: "${reason}"`,
    metadata:    { staffIds: ids, reason, modifiedCount: result.modifiedCount },
  });

  (res as AppResponse).data(
    { modifiedCount: result.modifiedCount, matchedCount: result.matchedCount },
    `${result.modifiedCount} staff member(s) suspended successfully`
  );
});

export const bulkDelete = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0)
    return next(new AppError('Staff IDs array is required', 400));
  if (req.user && ids.includes(req.user.id))
    return next(new AppError('You cannot delete your own account', 400));

  const result = await Staff.deleteMany({ _id: { $in: ids } });

  await logActivity(req, {
    action:      ACTIONS.STAFF_BULK_DELETED,
    description: `Bulk-deleted ${result.deletedCount} staff account(s)`,
    metadata:    { staffIds: ids, deletedCount: result.deletedCount },
  });

  (res as AppResponse).data(
    { deletedCount: result.deletedCount },
    `${result.deletedCount} staff member(s) deleted successfully`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOGS (per-staff + global feed)
// ─────────────────────────────────────────────────────────────────────────────

export const getActivityLogs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  const {
    page = 1, limit = 20,
    category, severity,
    startDate, endDate,
    search,
  } = req.query;

  const params: FeedParams = {
    page:     parseInt(page as string),
    limit:    parseInt(limit as string),
    actorId:  req.params.id,
    category: category as any,
    severity: severity as any,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate:   endDate   ? new Date(endDate   as string) : undefined,
    search:   search as string | undefined,
  };

  const { logs, total } = await ActivityLog.getStaffLogs(req.params.id, params);

  (res as AppResponse).data(
    {
      logs,
      pagination: {
        page: params.page, limit: params.limit,
        total, totalPages: Math.ceil(total / params.limit!),
      },
    },
    'Activity logs retrieved successfully',
    200
  );
});

/**
 * Global activity feed – all staff, filterable.
 * GET /api/v1/admin/staff/activity-feed
 */
export const getGlobalActivityFeed = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1, limit = 20,
    category, severity,
    actorId, targetType,
    startDate, endDate,
    search,
  } = req.query;

  const params: FeedParams = {
    page:       parseInt(page as string),
    limit:      parseInt(limit as string),
    category:   category   as any,
    severity:   severity   as any,
    actorId:    actorId    as string | undefined,
    targetType: targetType as string | undefined,
    startDate:  startDate  ? new Date(startDate as string) : undefined,
    endDate:    endDate    ? new Date(endDate   as string) : undefined,
    search:     search     as string | undefined,
  };

  const { logs, total, pages } = await ActivityLog.getFeed(params);

  (res as AppResponse).data(
    {
      logs,
      pagination: { page: params.page, limit: params.limit, total, pages },
    },
    'Activity feed retrieved successfully'
  );
});

/**
 * Dashboard summary widget – activity counts per category for last N hours.
 * GET /api/v1/admin/staff/activity-summary?hours=24
 */
export const getActivitySummary = asyncHandler(async (req: Request, res: Response) => {
  const hours = parseInt((req.query.hours as string) || '24');
  const summary = await ActivityLog.getSummary(hours);

  (res as AppResponse).data(summary, 'Activity summary retrieved successfully');
});
