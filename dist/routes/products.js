"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ProductController_1 = require("../controllers/admin/ProductController");
const auth_1 = require("../middleware/auth");
const productValidation_1 = require("../middleware/productValidation");
const cloudinary_1 = require("../services/cloudinary");
const router = (0, express_1.Router)();
// Public routes
router.get('/deals/deals-of-the-day', ProductController_1.getDealsOfTheDay);
router.get('/sku/:sku', ProductController_1.getProductBySku);
router.get('/:id', ProductController_1.getProduct);
router.use(auth_1.ifToken);
router.get('/', ProductController_1.getProducts);
// Protected/Admin routes
router.use(auth_1.protect);
router.use((0, auth_1.authorize)('admin'));
router.get('/low-stock/products', ProductController_1.getLowStockProducts);
router.patch('/bulk-update', productValidation_1.validateBulkUpdate, ProductController_1.bulkUpdateProducts);
// Deals of the day management
router.post('/deals-of-the-day', ProductController_1.setDealsOfTheDay);
router.delete('/:id/deals', ProductController_1.removeFromDeals);
// Product preview with analytics
router.get('/:id/preview', ProductController_1.getProductPreview);
router.get('/:id/stock-history', ProductController_1.getStockHistory);
// Product CRUD with image upload
router.post('/', cloudinary_1.upload.array('images', 5), productValidation_1.validateProductCreate, ProductController_1.createProduct);
router.put('/', cloudinary_1.upload.array('images', 5), productValidation_1.validateProductUpdate, ProductController_1.updateProduct);
router.delete('/:id', ProductController_1.deleteProduct);
// Stock management
router.patch('/:id/stock', productValidation_1.validateStockUpdate, ProductController_1.updateStock);
// Variants
router.post('/:id/variants', productValidation_1.validateVariant, ProductController_1.addVariant);
router.put('/:id/variants/:variantId', productValidation_1.validateVariant, ProductController_1.updateVariant);
router.delete('/:id/variants/:variantId', ProductController_1.deleteVariant);
// Regional distribution
router.put('/:id/distribution', ProductController_1.updateRegionalDistribution);
exports.default = router;
//# sourceMappingURL=products.js.map