"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const driver_1 = require("../controllers/driver");
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("../services/cloudinary");
const driverValidation_1 = require("../middleware/driverValidation");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.protect);
// Dashboard and statistics
router.get('/dashboard/summary', (0, auth_1.checkPermission)('view_users'), driver_1.getDashboardSummary);
// Driver CRUD routes
router.get('/', (0, auth_1.checkPermission)('view_users'), driver_1.getAllDrivers);
router.get('/:id', (0, auth_1.checkPermission)('view_users'), driver_1.getDriverById);
router.post('/', (0, auth_1.checkPermission)('create_users'), cloudinary_1.upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'driversLicense', maxCount: 1 }
]), driverValidation_1.validateDriverCreate, driver_1.createDriver);
router.put('/:id', (0, auth_1.checkPermission)('view_users'), cloudinary_1.upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'driversLicense', maxCount: 1 }
]), driverValidation_1.validateDriverUpdate, driver_1.updateDriver);
router.delete('/:id', (0, auth_1.checkPermission)('suspend_accounts'), driver_1.deleteDriver);
// Verification routes
router.post('/:id/verify', (0, auth_1.checkPermission)('create_users'), driver_1.verifyDriver);
router.post('/:id/reject', (0, auth_1.checkPermission)('create_users'), driver_1.rejectDriver);
// Account management routes
router.post('/:id/suspend', (0, auth_1.checkPermission)('suspend_accounts'), driver_1.suspendDriver);
router.post('/:id/unsuspend', (0, auth_1.checkPermission)('suspend_accounts'), driver_1.unsuspendDriver);
router.post('/:id/disable', (0, auth_1.checkPermission)('disable_accounts'), driver_1.disableDriver);
router.post('/:id/enable', (0, auth_1.checkPermission)('disable_accounts'), driver_1.enableDriver);
router.post('/:id/resend-password-link', (0, auth_1.checkPermission)('view_users'), driver_1.resendPasswordLink);
// Statistics and activity
router.get('/:id/statistics', (0, auth_1.checkPermission)('access_reports'), driver_1.getDriverStatistics);
router.get('/:id/activity-logs', (0, auth_1.checkPermission)('access_reports'), driver_1.getActivityLogs);
// Bulk operations
router.post('/bulk/suspend', (0, auth_1.checkPermission)('suspend_accounts'), driver_1.bulkSuspend);
router.delete('/bulk/delete', (0, auth_1.checkPermission)('suspend_accounts'), driver_1.bulkDelete);
exports.default = router;
//# sourceMappingURL=driver.js.map