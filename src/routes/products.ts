import { Router } from 'express';
import {
    getProducts,
    getProductsOverview,
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
    getStockHistory,
    setDealsOfTheDay,
    getDealsOfTheDay,
    removeFromDeals,
    downloadImportTemplate,
    importProductsFromCsv,
    exportProductsToCsv,
} from '../controllers/admin/ProductController';
import { protect, authorize, ifToken } from '../middleware/auth';
import {
    validateProductCreate,
    validateProductUpdate,
    validateVariant,
    validateStockUpdate,
    validateBulkUpdate
} from '../middleware/productValidation';
import { upload } from '../services/cloudinary';
import multer from 'multer';

// Separate multer instance for CSV uploads (memory storage, no image filter)
const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
        if (
            file.mimetype === 'text/csv' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.csv')
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed for import'));
        }
    },
});

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/deals/deals-of-the-day', getDealsOfTheDay);
router.get('/sku/:sku', getProductBySku);
router.get('/:id', getProduct);

// Token-optional (personalized search history when logged in)
router.use(ifToken);
router.get('/', getProducts);

// ── Admin-protected routes ────────────────────────────────────────────────────
router.use(protect);
router.use(authorize('admin'));

// Overview stats (standalone)
router.get('/overview/stats', getProductsOverview);

// Low stock
router.get('/low-stock/products', getLowStockProducts);

// Bulk update
router.patch('/bulk-update', validateBulkUpdate, bulkUpdateProducts);

// Deals of the day management
router.post('/deals-of-the-day', setDealsOfTheDay);
router.delete('/:id/deals', removeFromDeals);

// Product preview + stock history analytics
router.get('/:id/preview', getProductPreview);
router.get('/:id/stock-history', getStockHistory);

// ── CSV Import / Export ───────────────────────────────────────────────────────
// Download blank template
router.get('/import/template', downloadImportTemplate);

// Import from CSV  (field name must be "file")
router.post('/import', csvUpload.single('file'), importProductsFromCsv);

// Export current catalogue to CSV (supports same query filters as GET /)
router.get('/all/export', exportProductsToCsv);

// ── CRUD with image upload ────────────────────────────────────────────────────
router.post('/', upload.array('images', 5), validateProductCreate, createProduct);
router.put('/', upload.array('images', 5), validateProductUpdate, updateProduct);
router.delete('/:id', deleteProduct);

// Stock management
router.patch('/:id/stock', validateStockUpdate, updateStock);

// Variants
router.post('/:id/variants', validateVariant, addVariant);
router.put('/:id/variants/:variantId', validateVariant, updateVariant);
router.delete('/:id/variants/:variantId', deleteVariant);

// Regional distribution
router.put('/:id/distribution', updateRegionalDistribution);

export default router;