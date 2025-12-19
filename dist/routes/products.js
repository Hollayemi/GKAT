"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ProductController_1 = require("../controllers/admin/ProductController");
const auth_1 = require("../middleware/auth");
const productValidation_1 = require("../middleware/productValidation");
const router = (0, express_1.Router)();
// @route   GET /api/v1/products
// @desc    get products
router.get('/', ProductController_1.getProducts);
// @route   GET /api/v1/products/sku/:sku
// @desc    get product by sku
router.get('/sku/:sku', ProductController_1.getProductBySku);
router.use(auth_1.protect);
router.use((0, auth_1.authorize)('admin'));
// @route   GET /api/v1/products/low-stock
// @desc    get product with low quantity in stock
router.get('/low-stock', ProductController_1.getLowStockProducts);
// @route   GET /api/v1/products/bulk-update
// @desc    update product
router.patch('/bulk-update', productValidation_1.validateBulkUpdate, ProductController_1.bulkUpdateProducts);
// @route   GET /api/v1/products/:id/preview
// @desc    Get product preview with analytics
router.get('/:id/preview', ProductController_1.getProductPreview);
// @route   GET /api/v1/products/:id/stock-history
// @desc    Get stock movement history
router.get('/:id/stock-history', ProductController_1.getStockHistory);
// @route   POST /api/v1/products
// @desc    create product
router.post('/', productValidation_1.validateProductCreate, ProductController_1.createProduct);
// @route   GET /api/v1/products/:id
// @desc    get A product
router.get('/:id', ProductController_1.getProduct);
// @route   PUT /api/v1/products/:id
// @desc    update a product
router.put('/:id', productValidation_1.validateProductUpdate, ProductController_1.updateProduct);
// @route   DELETE /api/v1/products/:id
// @desc    delete a product
router.delete('/:id', ProductController_1.deleteProduct);
// @route   PATCH /api/v1/products
// @desc    update product stock
router.patch('/:id/stock', productValidation_1.validateStockUpdate, ProductController_1.updateStock);
router.post('/:id/variants', productValidation_1.validateVariant, ProductController_1.addVariant);
router.put('/:id/variants/:variantId', productValidation_1.validateVariant, ProductController_1.updateVariant);
router.delete('/:id/variants/:variantId', ProductController_1.deleteVariant);
router.put('/:id/distribution', ProductController_1.updateRegionalDistribution);
router.patch('/bulk-update', productValidation_1.validateBulkUpdate, ProductController_1.bulkUpdateProducts);
exports.default = router;
//# sourceMappingURL=products.js.map