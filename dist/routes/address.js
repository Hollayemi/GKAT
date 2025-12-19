"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const address_1 = require("../controllers/address");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.protect);
// @route   GET /api/v1/addresses/default
router.get('/default', address_1.getDefaultAddress);
// @route   GET /api/v1/addresses
// @desc    Get all addresses for user
router.get('/', address_1.getAddresses);
// @route   POST /api/v1/addresses
// @desc    Create new address
router.post('/', address_1.createAddress);
// @route   GET /api/v1/addresses/:id
// @desc    Get single address
router.get('/:id', address_1.getAddress);
// @route   PUT /api/v1/addresses/:id
// @desc    Update address
router.put('/:id', address_1.updateAddress);
// @route   DELETE /api/v1/addresses/:id
// @desc    Delete address
router.delete('/:id', address_1.deleteAddress);
// @route   PATCH /api/v1/addresses/:id/default
// @desc    Set address as default
router.patch('/:id/default', address_1.setDefaultAddress);
exports.default = router;
//# sourceMappingURL=address.js.map