"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const coupon_1 = require("../controllers/admin/coupon");
const auth_1 = require("../middleware/auth");
const couponValidation_1 = require("../middleware/couponValidation");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.use((0, auth_1.authorize)('admin'));
// @route   GET /api/v1/admin/coupons
// @desc    Get all coupons with filtering and stats
router.get('/', coupon_1.getCoupons);
// @route   PATCH /api/v1/admin/coupons/bulk-update
// @desc    Bulk update coupons
router.patch('/bulk-update', coupon_1.bulkUpdateCoupons);
// @route   POST /api/v1/admin/coupons
// @desc    Create new coupon
router.post('/', couponValidation_1.validateCouponCreate, coupon_1.createCoupon);
// @route   GET /api/v1/admin/coupons/:id
// @desc    Get single coupon
router.get('/:id', coupon_1.getCoupon);
// @route   PUT /api/v1/admin/coupons/:id
// @desc    Update coupon
router.put('/:id', couponValidation_1.validateCouponUpdate, coupon_1.updateCoupon);
// @route   DELETE /api/v1/admin/coupons/:id
// @desc    Delete coupon
router.delete('/:id', coupon_1.deleteCoupon);
// @route   PATCH /api/v1/admin/coupons/:id/toggle-status
// @desc    Toggle coupon status (enable/disable)
router.patch('/:id/toggle-status', coupon_1.toggleCouponStatus);
// @route   PATCH /api/v1/admin/coupons/:id/status
// @desc    Change coupon status (draft/active)
router.patch('/:id/status', coupon_1.changeCouponStatus);
exports.default = router;
//# sourceMappingURL=coupon.js.map