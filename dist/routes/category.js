"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const categoryController_1 = require("../controllers/admin/categoryController");
const router = express_1.default.Router();
// Public routes
router.get('/', categoryController_1.getAllCategories);
router.get('/with-count', categoryController_1.getCategoriesWithCount);
router.get('/search', categoryController_1.searchCategories);
router.get('/:id', categoryController_1.getCategory);
// router.use(authorize('admin'));
// router.use(protect);
// Protected/Admin routes
router.post('/', categoryController_1.createCategory);
router.put('/:id', categoryController_1.updateCategory);
router.delete('/:id', categoryController_1.deleteCategory);
router.patch('/:id/toggle-active', categoryController_1.toggleCategoryActive);
router.put('/reorder', categoryController_1.reorderCategories);
exports.default = router;
//# sourceMappingURL=category.js.map