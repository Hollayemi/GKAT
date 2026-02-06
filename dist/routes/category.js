"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const categoryController_1 = require("../controllers/admin/categoryController");
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("../services/cloudinary");
const router = express_1.default.Router();
// Public routes
router.get('/', categoryController_1.getAllCategories);
router.get('/with-count', categoryController_1.getCategoriesWithCount);
router.get('/search', categoryController_1.searchCategories);
router.get('/filter/:id', categoryController_1.getCategoryWithProducts);
router.get('/:id', categoryController_1.getCategory);
// Protected/Admin routes
router.use(auth_1.protect);
router.use((0, auth_1.authorize)('admin'));
router.post('/', cloudinary_1.upload.single('icon'), categoryController_1.createCategory);
router.put('/:id', cloudinary_1.upload.single('icon'), categoryController_1.updateCategory);
router.delete('/:id', categoryController_1.deleteCategory);
router.patch('/:id/toggle-active', categoryController_1.toggleCategoryActive);
router.put('/reorder', categoryController_1.reorderCategories);
exports.default = router;
//# sourceMappingURL=category.js.map