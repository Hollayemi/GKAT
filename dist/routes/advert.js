"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const advertController_1 = require("../controllers/admin/advertController");
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("../services/cloudinary");
const router = (0, express_1.Router)();
// Public routes
router.get('/', advertController_1.getAdverts);
router.get('/:id', advertController_1.getAdvert);
router.post('/:id/click', advertController_1.trackAdvertClick);
// Protected/Admin routes
router.use(auth_1.protect);
// router.use(authorize('admin'));
router.post('/', cloudinary_1.upload.single('image'), advertController_1.createAdvert);
router.get('/stats/summary', advertController_1.getAdvertStats);
router.put('/reorder', advertController_1.reorderAdverts);
router.put('/:id', cloudinary_1.upload.single('image'), advertController_1.updateAdvert);
router.delete('/:id', advertController_1.deleteAdvert);
router.patch('/:id/toggle', advertController_1.toggleAdvertStatus);
exports.default = router;
//# sourceMappingURL=advert.js.map