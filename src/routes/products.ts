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
    bulkUpdateProducts,
    getProductPreview,
    getStockHistory
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

// @route   GET /api/v1/products
// @desc    get products
router.get('/', getProducts);

// @route   GET /api/v1/products/sku/:sku
// @desc    get product by sku
router.get('/sku/:sku', getProductBySku);


router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/v1/products/low-stock
// @desc    get product with low quantity in stock
router.get('/low-stock', getLowStockProducts);

// @route   GET /api/v1/products/bulk-update
// @desc    update product
router.patch('/bulk-update', validateBulkUpdate, bulkUpdateProducts);


// @route   GET /api/v1/products/:id/preview
// @desc    Get product preview with analytics
router.get('/:id/preview', getProductPreview);

// @route   GET /api/v1/products/:id/stock-history
// @desc    Get stock movement history
router.get('/:id/stock-history', getStockHistory);



// @route   POST /api/v1/products
// @desc    create product
router.post('/', validateProductCreate, createProduct);

// @route   GET /api/v1/products/:id
// @desc    get A product
router.get('/:id', getProduct);

// @route   PUT /api/v1/products/:id
// @desc    update a product
router.put('/:id', validateProductUpdate, updateProduct);

// @route   DELETE /api/v1/products/:id
// @desc    delete a product
router.delete('/:id', deleteProduct);

// @route   PATCH /api/v1/products
// @desc    update product stock
router.patch('/:id/stock', validateStockUpdate, updateStock);


router.post('/:id/variants', validateVariant, addVariant);
router.put('/:id/variants/:variantId', validateVariant, updateVariant);
router.delete('/:id/variants/:variantId', deleteVariant);


router.put('/:id/distribution', updateRegionalDistribution);


router.patch('/bulk-update', validateBulkUpdate, bulkUpdateProducts);

export default router;