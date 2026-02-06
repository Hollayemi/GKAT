"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pushNotificationController_1 = require("../controllers/pushNotificationController");
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("../services/cloudinary");
const pushNotificationValidation_middleware_1 = require("../middleware/pushNotificationValidation.middleware");
const router = (0, express_1.Router)();
// Public routes (for mobile app tracking)
router.post('/:id/delivered', pushNotificationController_1.trackDelivered);
router.post('/:id/clicked', pushNotificationController_1.trackClicked);
// All other routes require authentication
router.use(auth_1.protect);
// Statistics
router.get('/statistics', (0, auth_1.checkPermission)('access_reports'), pushNotificationController_1.getStatistics);
// Test notification
router.post('/test', (0, auth_1.checkPermission)('manage_promotions'), pushNotificationController_1.testNotification);
// Estimate recipients
router.post('/estimate-recipients', (0, auth_1.checkPermission)('manage_promotions'), pushNotificationController_1.estimateRecipients);
// CRUD routes
router.get('/', (0, auth_1.checkPermission)('manage_promotions'), pushNotificationController_1.getAllNotifications);
router.get('/:id', (0, auth_1.checkPermission)('manage_promotions'), pushNotificationController_1.getNotificationById);
router.post('/', (0, auth_1.checkPermission)('manage_promotions'), cloudinary_1.upload.single('image'), pushNotificationValidation_middleware_1.validateNotificationCreate, pushNotificationController_1.createNotification);
router.put('/:id', (0, auth_1.checkPermission)('manage_promotions'), cloudinary_1.upload.single('image'), pushNotificationValidation_middleware_1.validateNotificationUpdate, pushNotificationController_1.updateNotification);
router.delete('/:id', (0, auth_1.checkPermission)('manage_promotions'), pushNotificationController_1.deleteNotification);
// Send notification
router.post('/:id/send', (0, auth_1.checkPermission)('manage_promotions'), pushNotificationController_1.sendNotification);
exports.default = router;
//# sourceMappingURL=pushNotification.js.map