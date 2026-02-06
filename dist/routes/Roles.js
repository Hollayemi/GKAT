"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const RoleController_1 = require("../controllers/admin/RoleController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.protect);
// Permission routes
router.get('/permissions', RoleController_1.getAllPermissions);
// Role CRUD routes
router.get('/', (0, auth_1.checkPermission)('view_users'), RoleController_1.getAllRoles);
router.get('/:id', (0, auth_1.checkPermission)('view_users'), RoleController_1.getRoleById);
router.post('/', (0, auth_1.checkPermission)('manage_roles'), RoleController_1.createRole);
router.put('/:id', (0, auth_1.checkPermission)('manage_roles'), RoleController_1.updateRole);
router.delete('/:id', (0, auth_1.checkPermission)('manage_roles'), RoleController_1.deleteRole);
// Permission management
router.post('/:id/permissions', (0, auth_1.checkPermission)('manage_roles'), RoleController_1.addPermissionToRole);
router.delete('/:id/permissions/:permissionId', (0, auth_1.checkPermission)('manage_roles'), RoleController_1.removePermissionFromRole);
exports.default = router;
//# sourceMappingURL=Roles.js.map