"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const regionController_1 = require("../controllers/admin/regionController");
const router = express_1.default.Router();
// Public routes
router.get('/', regionController_1.getAllRegions);
router.get('/with-count', regionController_1.getRegionsWithCount);
router.get('/search', regionController_1.searchRegions);
router.get('/:id', regionController_1.getRegion);
// router.use(authorize('admin'));
// router.use(protect);
// Protected/Admin routes
router.post('/', regionController_1.createRegion);
router.put('/:id', regionController_1.updateRegion);
router.delete('/:id', regionController_1.deleteRegion);
router.patch('/:id/toggle-active', regionController_1.toggleRegionActive);
router.put('/reorder', regionController_1.reorderRegions);
exports.default = router;
//# sourceMappingURL=region.js.map