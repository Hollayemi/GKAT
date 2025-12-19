"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockHistory = exports.getProductPreview = exports.bulkUpdateProducts = exports.getLowStockProducts = exports.updateRegionalDistribution = exports.deleteVariant = exports.updateVariant = exports.addVariant = exports.updateStock = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProductBySku = exports.getProduct = exports.getProducts = void 0;
const Product_1 = __importDefault(require("../../models/admin/Product"));
const Orders_1 = __importDefault(require("../../models/Orders"));
const error_1 = require("../../middleware/error");
const mongoose_1 = __importDefault(require("mongoose"));
const pipeline_1 = require("./pipeline");
// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { category, status, search, minPrice, maxPrice, tags, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const query = {};
    if (category) {
        query.category = category;
    }
    if (status && (status === 'active' || status === 'inactive')) {
        query.status = status;
    }
    else {
        query.status = 'active';
    }
    if (status === 'all') {
        delete query.status;
    }
    else if (status === 'low-stock') {
        query.stockQuantity = { $lt: 10 };
    }
    else if (status === 'out-of-stock') {
        query.stockQuantity = 0;
    }
    if (search) {
        query.$text = { $search: search };
    }
    if (minPrice || maxPrice) {
        query.salesPrice = {};
        if (minPrice)
            query.salesPrice.$gte = parseFloat(minPrice);
        if (maxPrice)
            query.salesPrice.$lte = parseFloat(maxPrice);
    }
    if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim());
        query.tags = { $in: tagArray };
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    console.log({ query, pageNum, limitNum, skip, sort });
    const products = await Product_1.default.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v');
    const total = await Product_1.default.countDocuments(query);
    res.data({
        products,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        }
    }, 'Products retrieved successfully');
});
// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = (0, error_1.asyncHandler)(async (req, res, next) => {
    const product = await Product_1.default.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email').lean();
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    res.data({ ...product }, 'Product retrieved successfully');
});
// @desc    Get product by SKU
// @route   GET /api/v1/products/sku/:sku
// @access  Public
exports.getProductBySku = (0, error_1.asyncHandler)(async (req, res, next) => {
    const product = await Product_1.default.findOne({ sku: req.params.sku.toUpperCase() })
        .populate('createdBy', 'name email');
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    res.data({ product }, 'Product retrieved successfully');
});
// @desc    Create new product
// @route   POST /api/v1/products
// @access  Private/Admin
exports.createProduct = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    req.body.createdBy = req.user.id;
    const existingProduct = await Product_1.default.findOne({ sku: req.body.sku?.toUpperCase() });
    if (existingProduct) {
        return next(new error_1.AppError('Product with this SKU already exists', 409));
    }
    const product = await Product_1.default.create({
        ...req.body,
        salesPrice: parseFloat(req.body.salesPrice),
        stockQuantity: parseInt(req.body.stockQuantity)
    });
    res.data({ product }, 'Product created successfully', 201);
});
// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Private/Admin
exports.updateProduct = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    let product = await Product_1.default.findById(req.params.id);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    if (req.body.sku && req.body.sku.toUpperCase() !== product.sku) {
        const existingProduct = await Product_1.default.findOne({ sku: req.body.sku.toUpperCase() });
        if (existingProduct) {
            return next(new error_1.AppError('Product with this SKU already exists', 409));
        }
    }
    req.body.updatedBy = req.user.id;
    product = await Product_1.default.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });
    res.data({ product }, 'Product updated successfully');
});
// @desc    Delete product
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
exports.deleteProduct = (0, error_1.asyncHandler)(async (req, res, next) => {
    const product = await Product_1.default.findById(req.params.id);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    await product.deleteOne();
    res.success('Product deleted successfully');
});
// @desc    Update product stock
// @route   PATCH /api/v1/products/:id/stock
// @access  Private/Admin
exports.updateStock = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { stockQuantity, variantId, variantStock } = req.body;
    const product = await Product_1.default.findById(req.params.id);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    if (stockQuantity !== undefined) {
        if (stockQuantity < 0) {
            return next(new error_1.AppError('Stock quantity cannot be negative', 400));
        }
        product.stockQuantity = stockQuantity;
    }
    if (variantId && variantStock !== undefined) {
        const variant = product.variants.find(v => v._id?.toString() === variantId);
        if (!variant) {
            return next(new error_1.AppError('Variant not found', 404));
        }
        if (variantStock < 0) {
            return next(new error_1.AppError('Stock quantity cannot be negative', 400));
        }
        variant.stockQuantity = variantStock;
    }
    await product.save();
    res.data({ product }, 'Stock updated successfully');
});
// @desc    Add product variant
// @route   POST /api/v1/products/:id/variants
// @access  Private/Admin
exports.addVariant = (0, error_1.asyncHandler)(async (req, res, next) => {
    const product = await Product_1.default.findById(req.params.id);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    const existingVariant = product.variants.find(v => v.sku === req.body.sku?.toUpperCase());
    if (existingVariant) {
        return next(new error_1.AppError('Variant with this SKU already exists', 409));
    }
    product.variants.push(req.body);
    await product.save();
    res.data({ product }, 'Variant added successfully', 201);
});
// @desc    Update product variant
// @route   PUT /api/v1/products/:id/variants/:variantId
// @access  Private/Admin
exports.updateVariant = (0, error_1.asyncHandler)(async (req, res, next) => {
    const product = await Product_1.default.findById(req.params.id);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    const variantIndex = product.variants.findIndex(v => v._id?.toString() === req.params.variantId);
    if (variantIndex === -1) {
        return next(new error_1.AppError('Variant not found', 404));
    }
    Object.assign(product.variants[variantIndex], req.body);
    await product.save();
    res.data({ product }, 'Variant updated successfully');
});
// @desc    Delete product variant
// @route   DELETE /api/v1/products/:id/variants/:variantId
// @access  Private/Admin
exports.deleteVariant = (0, error_1.asyncHandler)(async (req, res, next) => {
    const product = await Product_1.default.findById(req.params.id);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    const variantIndex = product.variants.findIndex(v => v._id?.toString() === req.params.variantId);
    if (variantIndex === -1) {
        return next(new error_1.AppError('Variant not found', 404));
    }
    product.variants.splice(variantIndex, 1);
    await product.save();
    res.success('Variant deleted successfully');
});
// @desc    Update regional distribution
// @route   PUT /api/v1/products/:id/distribution
// @access  Private/Admin
exports.updateRegionalDistribution = (0, error_1.asyncHandler)(async (req, res, next) => {
    const product = await Product_1.default.findById(req.params.id);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    product.regionalDistribution = req.body.regionalDistribution;
    await product.save();
    res.data({ product }, 'Regional distribution updated successfully');
});
// @desc    Get low stock products
// @route   GET /api/v1/products/low-stock
// @access  Private/Admin
exports.getLowStockProducts = (0, error_1.asyncHandler)(async (req, res, next) => {
    const products = await Product_1.default.find({
        $expr: { $lte: ['$stockQuantity', '$minimumStockAlert'] }
    }).populate('createdBy', 'name email');
    res.data({
        products,
        count: products.length
    }, 'Low stock products retrieved successfully');
});
// @desc    Bulk update products
// @route   PATCH /api/v1/products/bulk-update
// @access  Private/Admin
exports.bulkUpdateProducts = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { productIds, updates } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return next(new error_1.AppError('Please provide product IDs', 400));
    }
    if (!updates) {
        return next(new error_1.AppError('Please provide updates', 400));
    }
    const result = await Product_1.default.updateMany({ _id: { $in: productIds } }, { $set: updates });
    res.data({
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
    }, 'Products updated successfully');
});
// @desc    Get product preview with full analytics
// @route   GET /api/v1/products/:id/preview
// @access  Private/Admin
exports.getProductPreview = (0, error_1.asyncHandler)(async (req, res, next) => {
    const productId = req.params.id;
    // Validate product ID
    if (!mongoose_1.default.Types.ObjectId.isValid(productId)) {
        return next(new error_1.AppError('Invalid product ID', 400));
    }
    // Fetch product with creator info
    const product = await Product_1.default.findById(productId)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    // Calculate total sales and revenue
    const o_productId = new mongoose_1.default.Types.ObjectId(productId);
    const salesData = await Orders_1.default.aggregate((0, pipeline_1.salesReveniuePipeline)(o_productId));
    // Calculate sales trend (last 4 months)
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const salesTrend = await Orders_1.default.aggregate((0, pipeline_1.salesTrendPipeline)(o_productId, fourMonthsAgo));
    // Calculate previous month comparison
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const [lastMonthSales, previousMonthSales] = await Promise.all([
        Orders_1.default.aggregate((0, pipeline_1.lastMonthSalesPipeline)(o_productId, lastMonth, twoMonthsAgo)),
        Orders_1.default.aggregate((0, pipeline_1.previousMonthSalesPipeline)(o_productId, twoMonthsAgo, lastMonth))
    ]);
    // Calculate percentage change
    const currentMonthRevenue = lastMonthSales[0]?.total || 0;
    const previousRevenue = previousMonthSales[0]?.total || 0;
    let percentageChange = 0;
    if (previousRevenue > 0) {
        percentageChange = ((currentMonthRevenue - previousRevenue) / previousRevenue) * 100;
    }
    else if (currentMonthRevenue > 0) {
        percentageChange = 100;
    }
    // Get stock movement history (last 7 days by default)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const stockHistory = await Orders_1.default.aggregate((0, pipeline_1.stockHistoryPipeline)(o_productId, sevenDaysAgo));
    // Calculate total stock including variants
    const totalStock = product.stockQuantity +
        (product.variants?.reduce((sum, variant) => sum + variant.stockQuantity, 0) || 0);
    // Calculate stock status
    let stockStatus;
    if (product.stockQuantity === 0) {
        stockStatus = 'out-of-stock';
    }
    else if (product.stockQuantity <= product.minimumStockAlert) {
        stockStatus = 'low-stock';
    }
    else {
        stockStatus = 'in-stock';
    }
    // Format regional distribution data
    const regionalInventory = product.regionalDistribution?.map(region => ({
        region: region.region,
        currentStock: region.mainProduct,
        lastRestocked: null,
        manager: null,
        status: region.mainProduct === 0 ? 'Out of Stock' :
            region.mainProduct <= 10 ? 'Low Stock' :
                region.mainProduct <= 50 ? 'Stable' : 'Balanced',
        variants: region.variants.map(v => {
            const variant = product.variants.find(pv => pv._id?.toString() === v.variantId);
            return {
                variantId: v.variantId,
                variantName: variant ? `${variant.unitQuantity} ${variant.unitType}` : 'Unknown',
                quantity: v.quantity
            };
        })
    })) || [];
    // Prepare response data
    const responseData = {
        product: {
            _id: product._id,
            productId: product.productId,
            sku: product.sku,
            productName: product.productName,
            brand: product.brand,
            category: product.category,
            description: product.description,
            images: product.images,
            status: product.status,
            tags: product.tags,
            // Pricing
            salesPrice: product.salesPrice,
            unitType: product.unitType,
            unitQuantity: product.unitQuantity,
            // Stock
            stockQuantity: product.stockQuantity,
            totalStock,
            minimumStockAlert: product.minimumStockAlert,
            stockStatus,
            // Variants
            variants: product.variants,
            // Metadata
            createdBy: product.createdBy,
            updatedBy: product.updatedBy,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt
        },
        analytics: {
            totalSales: salesData[0]?.totalSales || 0,
            totalQuantitySold: salesData[0]?.totalQuantitySold || 0,
            totalOrders: salesData[0]?.totalOrders || 0,
            percentageChange: Number(percentageChange.toFixed(2)),
            salesTrend: salesTrend.map(trend => ({
                month: trend.month,
                revenue: trend.revenue,
                quantity: trend.quantity
            }))
        },
        pricing: {
            salesPrice: product.salesPrice,
            costPerItem: 0,
            profit: 0,
            grossMargin: 0
        },
        inventory: {
            byRegion: regionalInventory,
            stockHistory: stockHistory
        },
        overview: {
            sku: product.sku,
            category: product.category,
            stockLevel: `${product.stockQuantity} ${product.unitType}${product.stockQuantity !== 1 ? 's' : ''} remaining`,
            weightQuantity: `1 ${product.unitType} (~${product.unitQuantity})`,
            availabilityStatus: product.status,
            tags: product.tags
        }
    };
    res.data(responseData, 'Product preview retrieved successfully');
});
// @desc    Get stock movement history with filters
// @route   GET /api/v1/products/:id/stock-history
// @access  Private/Admin
exports.getStockHistory = (0, error_1.asyncHandler)(async (req, res, next) => {
    const productId = req.params.id;
    const { days = 7, limit = 20, page = 1 } = req.query;
    if (!mongoose_1.default.Types.ObjectId.isValid(productId)) {
        return next(new error_1.AppError('Invalid product ID', 400));
    }
    const product = await Product_1.default.findById(productId);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(days));
    const skip = (Number(page) - 1) * Number(limit);
    const stockHistory = await Orders_1.default.aggregate((0, pipeline_1.getStockHistoryPipeline)(new mongoose_1.default.Types.ObjectId(productId), daysAgo, skip, Number(limit)));
    res.data({
        history: stockHistory[0].history,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total: stockHistory[0].total[0]?.count || 0,
            pages: Math.ceil((stockHistory[0].total[0]?.count || 0) / Number(limit))
        }
    }, 'Stock history retrieved successfully');
});
//# sourceMappingURL=ProductController.js.map