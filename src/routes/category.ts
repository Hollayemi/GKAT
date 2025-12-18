import express from 'express';
import {
    getAllCategories,
    getCategoriesWithCount,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    searchCategories,
    toggleCategoryActive,
    reorderCategories
} from '../controllers/admin/categoryController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/with-count', getCategoriesWithCount);
router.get('/search', searchCategories);
router.get('/:id', getCategory);

// router.use(authorize('admin'));
// router.use(protect);

// Protected/Admin routes
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);
router.patch('/:id/toggle-active', toggleCategoryActive);
router.put('/reorder', reorderCategories);

export default router;