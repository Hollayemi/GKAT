import { Request, Response, NextFunction } from 'express';
import Role from '../../models/admin/Roles.models';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';

const PERMISSIONS = [
    {
        id: 'view_users',
        name: 'View and Manage Users',
        description: 'View all users in the system and manage their basic information'
    },
    {
        id: 'create_users',
        name: 'Create New Users (except Super Admin)',
        description: 'Create new user accounts with any role except Super Admin'
    },
    {
        id: 'suspend_accounts',
        name: 'Suspend or Disable Accounts',
        description: 'Temporarily suspend or permanently disable user accounts'
    },
    {
        id: 'disable_accounts',
        name: 'Disable Accounts',
        description: 'Permanently disable user accounts'
    },
    {
        id: 'access_reports',
        name: 'Access Reports & Logs',
        description: 'View system reports, activity logs, and analytics'
    },
    {
        id: 'manage_promotions',
        name: 'Manage Promotions and Templates',
        description: 'Create, edit, and delete promotional campaigns and email templates'
    },
    {
        id: 'assign_roles',
        name: 'Assign Roles (excluding Super Admin)',
        description: 'Assign or change user roles, except Super Admin role'
    },
    {
        id: 'view_financial_dashboard',
        name: 'View Financial Dashboard',
        description: 'Access financial reports, revenue data, and transaction history'
    },
    {
        id: 'system_settings',
        name: 'System Settings',
        description: 'Modify system-wide settings and configurations'
    },
    {
        id: 'manage_roles',
        name: 'Manage Roles',
        description: 'Create, edit, and delete role definitions'
    }
];

export const getAllRoles = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const roles = await Role.find().sort({ createdAt: 1 }).lean();

    (res as AppResponse).data(roles, 'Roles retrieved successfully');
});

export const getRoleById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const role = await Role.findById(req.params.id).lean();

    if (!role) {
        return next(new AppError('Role not found', 404));
    }

    (res as AppResponse).data({ role }, 'Role retrieved successfully');
});

export const createRole = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name, displayName, permissions } = req.body;

    const existingRole = await Role.findOne({ name: name.toLowerCase() });
    if (existingRole) {
        return next(new AppError('Role with this name already exists', 400, 'DUPLICATE_ROLE'));
    }

    const validPermissionIds = PERMISSIONS.map(p => p.id);
    const invalidPermissions = permissions.filter((p: string) => !validPermissionIds.includes(p));

    if (invalidPermissions.length > 0) {
        return next(new AppError(
            `Invalid permissions: ${invalidPermissions.join(', ')}`,
            400,
            'VALIDATION_ERROR'
        ));
    }

    const role = await Role.create({
        name: name.toLowerCase(),
        displayName,
        permissions
    });

    (res as AppResponse).data({ role }, 'Role created successfully', 201);
});

export const updateRole = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name, displayName, permissions } = req.body;

    const role = await Role.findById(req.params.id);

    if (!role) {
        return next(new AppError('Role not found', 404));
    }

    if (name && name !== role.name) {
        const existingRole = await Role.findOne({ name: name.toLowerCase() });
        if (existingRole) {
            return next(new AppError('Role with this name already exists', 400));
        }
    }

    if (permissions) {
        const validPermissionIds = PERMISSIONS.map(p => p.id);
        const invalidPermissions = permissions.filter((p: string) => !validPermissionIds.includes(p));

        if (invalidPermissions.length > 0) {
            return next(new AppError(
                `Invalid permissions: ${invalidPermissions.join(', ')}`,
                400,
                'VALIDATION_ERROR'
            ));
        }
    }

    if (name) role.name = name.toLowerCase();
    if (displayName) role.displayName = displayName;
    if (permissions) role.permissions = permissions;

    await role.save();

    (res as AppResponse).data({ role }, 'Role updated successfully');
});

export const deleteRole = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const role = await Role.findById(req.params.id);

    if (!role) {
        return next(new AppError('Role not found', 404));
    }

    const Staff = require('../models/Staff').default;
    const staffCount = await Staff.countDocuments({ role: req.params.id });

    if (staffCount > 0) {
        return next(new AppError(
            `Cannot delete role. ${staffCount} staff member(s) are currently assigned to this role.`,
            400
        ));
    }

    await role.deleteOne();

    (res as AppResponse).success('Role deleted successfully');
});

export const getAllPermissions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    (res as AppResponse).data(PERMISSIONS, 'Permissions retrieved successfully');
});

export const addPermissionToRole = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { permissionId } = req.body;

    if (!permissionId) {
        return next(new AppError('Permission ID is required', 400));
    }

    const role = await Role.findById(req.params.id);

    if (!role) {
        return next(new AppError('Role not found', 404));
    }

    const validPermissionIds = PERMISSIONS.map(p => p.id);
    if (!validPermissionIds.includes(permissionId)) {
        return next(new AppError('Invalid permission ID', 400));
    }

    if (role.permissions.includes(permissionId)) {
        return next(new AppError('Permission already exists in this role', 400));
    }

    role.permissions.push(permissionId);
    await role.save();

    (res as AppResponse).data({ role }, 'Permission added to role successfully');
});

export const removePermissionFromRole = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { permissionId } = req.params;

    const role = await Role.findById(req.params.id);

    if (!role) {
        return next(new AppError('Role not found', 404));
    }

    const permissionIndex = role.permissions.indexOf(permissionId);

    if (permissionIndex === -1) {
        return next(new AppError('Permission not found in this role', 404));
    }

    role.permissions.splice(permissionIndex, 1);
    await role.save();

    (res as AppResponse).data({ role }, 'Permission removed from role successfully');
});