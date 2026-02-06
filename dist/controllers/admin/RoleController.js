"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removePermissionFromRole = exports.addPermissionToRole = exports.getAllPermissions = exports.deleteRole = exports.updateRole = exports.createRole = exports.getRoleById = exports.getAllRoles = void 0;
const Roles_models_1 = __importDefault(require("../../models/admin/Roles.models"));
const error_1 = require("../../middleware/error");
// Available permissions with metadata
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
// @desc    Get all roles
// @route   GET /api/v1/roles
// @access  Private/Admin
exports.getAllRoles = (0, error_1.asyncHandler)(async (req, res, next) => {
    const roles = await Roles_models_1.default.find().sort({ createdAt: 1 }).lean();
    res.data(roles, 'Roles retrieved successfully');
});
// @desc    Get single role
// @route   GET /api/v1/roles/:id
// @access  Private/Admin
exports.getRoleById = (0, error_1.asyncHandler)(async (req, res, next) => {
    const role = await Roles_models_1.default.findById(req.params.id).lean();
    if (!role) {
        return next(new error_1.AppError('Role not found', 404));
    }
    res.data({ role }, 'Role retrieved successfully');
});
// @desc    Create new role
// @route   POST /api/v1/roles
// @access  Private/Admin (with manage_roles permission)
exports.createRole = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { name, displayName, permissions } = req.body;
    // Check if role already exists
    const existingRole = await Roles_models_1.default.findOne({ name: name.toLowerCase() });
    if (existingRole) {
        return next(new error_1.AppError('Role with this name already exists', 400, 'DUPLICATE_ROLE'));
    }
    // Validate permissions
    const validPermissionIds = PERMISSIONS.map(p => p.id);
    const invalidPermissions = permissions.filter((p) => !validPermissionIds.includes(p));
    if (invalidPermissions.length > 0) {
        return next(new error_1.AppError(`Invalid permissions: ${invalidPermissions.join(', ')}`, 400, 'VALIDATION_ERROR'));
    }
    const role = await Roles_models_1.default.create({
        name: name.toLowerCase(),
        displayName,
        permissions
    });
    res.data({ role }, 'Role created successfully', 201);
});
// @desc    Update role
// @route   PUT /api/v1/roles/:id
// @access  Private/Admin (with manage_roles permission)
exports.updateRole = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { name, displayName, permissions } = req.body;
    const role = await Roles_models_1.default.findById(req.params.id);
    if (!role) {
        return next(new error_1.AppError('Role not found', 404));
    }
    // Check if new name conflicts with existing role
    if (name && name !== role.name) {
        const existingRole = await Roles_models_1.default.findOne({ name: name.toLowerCase() });
        if (existingRole) {
            return next(new error_1.AppError('Role with this name already exists', 400));
        }
    }
    // Validate permissions if provided
    if (permissions) {
        const validPermissionIds = PERMISSIONS.map(p => p.id);
        const invalidPermissions = permissions.filter((p) => !validPermissionIds.includes(p));
        if (invalidPermissions.length > 0) {
            return next(new error_1.AppError(`Invalid permissions: ${invalidPermissions.join(', ')}`, 400, 'VALIDATION_ERROR'));
        }
    }
    // Update fields
    if (name)
        role.name = name.toLowerCase();
    if (displayName)
        role.displayName = displayName;
    if (permissions)
        role.permissions = permissions;
    await role.save();
    res.data({ role }, 'Role updated successfully');
});
// @desc    Delete role
// @route   DELETE /api/v1/roles/:id
// @access  Private/Admin (with manage_roles permission)
exports.deleteRole = (0, error_1.asyncHandler)(async (req, res, next) => {
    const role = await Roles_models_1.default.findById(req.params.id);
    if (!role) {
        return next(new error_1.AppError('Role not found', 404));
    }
    // Check if any staff members are using this role
    const Staff = require('../models/Staff').default;
    const staffCount = await Staff.countDocuments({ role: req.params.id });
    if (staffCount > 0) {
        return next(new error_1.AppError(`Cannot delete role. ${staffCount} staff member(s) are currently assigned to this role.`, 400));
    }
    await role.deleteOne();
    res.success('Role deleted successfully');
});
// @desc    Get all available permissions
// @route   GET /api/v1/permissions
// @access  Private/Admin
exports.getAllPermissions = (0, error_1.asyncHandler)(async (req, res, next) => {
    res.data(PERMISSIONS, 'Permissions retrieved successfully');
});
// @desc    Add permission to role
// @route   POST /api/v1/roles/:id/permissions
// @access  Private/Admin (with manage_roles permission)
exports.addPermissionToRole = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { permissionId } = req.body;
    if (!permissionId) {
        return next(new error_1.AppError('Permission ID is required', 400));
    }
    const role = await Roles_models_1.default.findById(req.params.id);
    if (!role) {
        return next(new error_1.AppError('Role not found', 404));
    }
    // Validate permission exists
    const validPermissionIds = PERMISSIONS.map(p => p.id);
    if (!validPermissionIds.includes(permissionId)) {
        return next(new error_1.AppError('Invalid permission ID', 400));
    }
    // Check if permission already exists
    if (role.permissions.includes(permissionId)) {
        return next(new error_1.AppError('Permission already exists in this role', 400));
    }
    role.permissions.push(permissionId);
    await role.save();
    res.data({ role }, 'Permission added to role successfully');
});
// @desc    Remove permission from role
// @route   DELETE /api/v1/roles/:id/permissions/:permissionId
// @access  Private/Admin (with manage_roles permission)
exports.removePermissionFromRole = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { permissionId } = req.params;
    const role = await Roles_models_1.default.findById(req.params.id);
    if (!role) {
        return next(new error_1.AppError('Role not found', 404));
    }
    const permissionIndex = role.permissions.indexOf(permissionId);
    if (permissionIndex === -1) {
        return next(new error_1.AppError('Permission not found in this role', 404));
    }
    role.permissions.splice(permissionIndex, 1);
    await role.save();
    res.data({ role }, 'Permission removed from role successfully');
});
//# sourceMappingURL=RoleController.js.map