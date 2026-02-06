"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staffController_1 = require("../controllers/admin/staffController");
const auth_1 = require("../middleware/auth");
const staffValidation_1 = require("../middleware/staffValidation");
const router = (0, express_1.Router)();
// All routes require authentication
router.post('/login', staffValidation_1.validateStaffLogin, staffController_1.loginStaff);
router.use(auth_1.protect);
// Staff CRUD routes
router.get('/', (0, auth_1.checkPermission)('view_users'), staffController_1.getAllStaff);
router.get('/one', (0, auth_1.checkPermission)('view_users'), staffController_1.getStaffById);
router.post('/', (0, auth_1.checkPermission)('create_users'), staffValidation_1.validateStaffCreate, staffController_1.createStaff);
router.put('/:id', (0, auth_1.checkPermission)('view_users'), staffValidation_1.validateStaffUpdate, staffController_1.updateStaff);
router.put('/:id/role', (0, auth_1.checkPermission)('assign_roles'), staffController_1.updateStaffRole);
router.delete('/:id', (0, auth_1.checkPermission)('suspend_accounts'), staffController_1.deleteStaff);
// Account management routes
router.post('/:id/suspend', (0, auth_1.checkPermission)('suspend_accounts'), staffController_1.suspendStaff);
router.post('/:id/unsuspend', (0, auth_1.checkPermission)('suspend_accounts'), staffController_1.unsuspendStaff);
router.post('/:id/disable', (0, auth_1.checkPermission)('disable_accounts'), staffController_1.disableStaff);
router.post('/:id/enable', (0, auth_1.checkPermission)('disable_accounts'), staffController_1.enableStaff);
router.post('/:id/reset-password', (0, auth_1.checkPermission)('view_users'), staffController_1.resetPassword);
// Bulk operations
router.post('/bulk/suspend', (0, auth_1.checkPermission)('suspend_accounts'), staffController_1.bulkSuspend);
router.delete('/bulk/delete', (0, auth_1.checkPermission)('suspend_accounts'), staffController_1.bulkDelete);
// Activity logs
router.get('/:id/activity-logs', (0, auth_1.checkPermission)('access_reports'), staffController_1.getActivityLogs);
exports.default = router;
//# sourceMappingURL=Staffs.js.map