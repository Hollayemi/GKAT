import { Router } from 'express';
import {
    getProducts,
    getProduct,
    getProductBySku,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    addVariant,
    updateVariant,
    deleteVariant,
    updateRegionalDistribution,
    getLowStockProducts,
    bulkUpdateProducts
} from '../controllers/admin/ProductController';
import { protect, authorize } from '../middleware/auth';
import {
    validateProductCreate,
    validateProductUpdate,
    validateVariant,
    validateStockUpdate,
    validateBulkUpdate
} from '../middleware/productValidation';

const router = Router();


// Public routes
router.get('/', getProducts);
router.get('/sku/:sku', getProductBySku);


// Protected routes - Admin only
router.use(protect);
router.use(authorize('admin'));


// Stock management (must come before /:id route)
router.get('/low-stock', getLowStockProducts);
router.patch('/bulk-update', validateBulkUpdate, bulkUpdateProducts);


// Product CRUD with validation
router.post('/', validateProductCreate, createProduct);
router.get('/:id', getProduct);
router.put('/:id', validateProductUpdate, updateProduct);
router.delete('/:id', deleteProduct);
router.patch('/:id/stock', validateStockUpdate, updateStock);


// Variant management
router.post('/:id/variants', validateVariant, addVariant);
router.put('/:id/variants/:variantId', validateVariant, updateVariant);
router.delete('/:id/variants/:variantId', deleteVariant);


// Regional distribution
router.put('/:id/distribution', updateRegionalDistribution);


// Bulk operations
router.patch('/bulk-update', validateBulkUpdate, bulkUpdateProducts);

export default router;