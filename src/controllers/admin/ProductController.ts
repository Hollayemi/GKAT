import { Request, Response, NextFunction } from 'express';
import Product from '../../models/admin/Product';
import Order from '../../models/Orders';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import mongoose from 'mongoose';
import { getStockHistoryPipeline, lastMonthSalesPipeline, previousMonthSalesPipeline, salesReveniuePipeline, salesTrendPipeline, stockHistoryPipeline } from './pipeline';


// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
export const getProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
        category,
        status,
        search,
        minPrice,
        maxPrice,
        tags,
        page = 1,
        limit = 20,
        sort = '-createdAt'
    } = req.query;

    const query: any = {};

    if (category) {
        query.category = category;
    }

    if (status && (status === 'active' || status === 'inactive')) {
        query.status = status;
    } else {
        query.status = 'active';
    }

    if (status === 'all') {
        delete query.status;
    } else if (status === 'low-stock') {
        query.stockQuantity = { $lt: 10 };
    } else if (status === 'out-of-stock') {
        query.stockQuantity = 0;
    }

    if (search) {
        query.$text = { $search: search as string };
    }

    if (minPrice || maxPrice) {
        query.salesPrice = {};
        if (minPrice) query.salesPrice.$gte = parseFloat(minPrice as string);
        if (maxPrice) query.salesPrice.$lte = parseFloat(maxPrice as string);
    }

    if (tags) {
        const tagArray = (tags as string).split(',').map(tag => tag.trim());
        query.tags = { $in: tagArray };
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    console.log({ query, pageNum, limitNum, skip, sort });

    const products = await Product.find(query)
        .sort(sort as string)
        .skip(skip)
        .limit(limitNum)
        .select('-__v');

    const total = await Product.countDocuments(query);

    (res as AppResponse).data(
        {
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        },
        'Products retrieved successfully'
    );
});

// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
export const getProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email').lean();

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    (res as AppResponse).data({ ...product }, 'Product retrieved successfully');
});


// @desc    Get product by SKU
// @route   GET /api/v1/products/sku/:sku
// @access  Public
export const getProductBySku = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findOne({ sku: req.params.sku.toUpperCase() })
        .populate('createdBy', 'name email');

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    (res as AppResponse).data({ product }, 'Product retrieved successfully');
});

// @desc    Create new product
// @route   POST /api/v1/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    req.body.createdBy = req.user.id;

    const existingProduct = await Product.findOne({ sku: req.body.sku?.toUpperCase() });
    if (existingProduct) {
        return next(new AppError('Product with this SKU already exists', 409));
    }

    const product = await Product.create({
        ...req.body,
        salesPrice: parseFloat(req.body.salesPrice),
        stockQuantity: parseInt(req.body.stockQuantity)
    });

    (res as AppResponse).data(
        { product },
        'Product created successfully',
        201
    );
});

// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    let product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    if (req.body.sku && req.body.sku.toUpperCase() !== product.sku) {
        const existingProduct = await Product.findOne({ sku: req.body.sku.toUpperCase() });
        if (existingProduct) {
            return next(new AppError('Product with this SKU already exists', 409));
        }
    }

    req.body.updatedBy = req.user.id;

    product = await Product.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    (res as AppResponse).data({ product }, 'Product updated successfully');
});

// @desc    Delete product
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    await product.deleteOne();

    (res as AppResponse).success('Product deleted successfully');
});

// @desc    Update product stock
// @route   PATCH /api/v1/products/:id/stock
// @access  Private/Admin
export const updateStock = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { stockQuantity, variantId, variantStock } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    if (stockQuantity !== undefined) {
        if (stockQuantity < 0) {
            return next(new AppError('Stock quantity cannot be negative', 400));
        }
        product.stockQuantity = stockQuantity;
    }

    if (variantId && variantStock !== undefined) {
        const variant = product.variants.find(v => v._id?.toString() === variantId);
        if (!variant) {
            return next(new AppError('Variant not found', 404));
        }
        if (variantStock < 0) {
            return next(new AppError('Stock quantity cannot be negative', 400));
        }
        variant.stockQuantity = variantStock;
    }

    await product.save();

    (res as AppResponse).data({ product }, 'Stock updated successfully');
});

// @desc    Add product variant
// @route   POST /api/v1/products/:id/variants
// @access  Private/Admin
export const addVariant = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    const existingVariant = product.variants.find(v => v.sku === req.body.sku?.toUpperCase());
    if (existingVariant) {
        return next(new AppError('Variant with this SKU already exists', 409));
    }

    product.variants.push(req.body);
    await product.save();

    (res as AppResponse).data({ product }, 'Variant added successfully', 201);
});

// @desc    Update product variant
// @route   PUT /api/v1/products/:id/variants/:variantId
// @access  Private/Admin
export const updateVariant = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    const variantIndex = product.variants.findIndex(
        v => v._id?.toString() === req.params.variantId
    );

    if (variantIndex === -1) {
        return next(new AppError('Variant not found', 404));
    }

    Object.assign(product.variants[variantIndex], req.body);
    await product.save();

    (res as AppResponse).data({ product }, 'Variant updated successfully');
});

// @desc    Delete product variant
// @route   DELETE /api/v1/products/:id/variants/:variantId
// @access  Private/Admin
export const deleteVariant = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    const variantIndex = product.variants.findIndex(
        v => v._id?.toString() === req.params.variantId
    );

    if (variantIndex === -1) {
        return next(new AppError('Variant not found', 404));
    }

    product.variants.splice(variantIndex, 1);
    await product.save();

    (res as AppResponse).success('Variant deleted successfully');
});

// @desc    Update regional distribution
// @route   PUT /api/v1/products/:id/distribution
// @access  Private/Admin
export const updateRegionalDistribution = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    product.regionalDistribution = req.body.regionalDistribution;
    await product.save();

    (res as AppResponse).data({ product }, 'Regional distribution updated successfully');
});

// @desc    Get low stock products
// @route   GET /api/v1/products/low-stock
// @access  Private/Admin
export const getLowStockProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const products = await Product.find({
        $expr: { $lte: ['$stockQuantity', '$minimumStockAlert'] }
    }).populate('createdBy', 'name email');

    (res as AppResponse).data(
        {
            products,
            count: products.length
        },
        'Low stock products retrieved successfully'
    );
});

// @desc    Bulk update products
// @route   PATCH /api/v1/products/bulk-update
// @access  Private/Admin
export const bulkUpdateProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { productIds, updates } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return next(new AppError('Please provide product IDs', 400));
    }

    if (!updates) {
        return next(new AppError('Please provide updates', 400));
    }

    const result = await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: updates }
    );

    (res as AppResponse).data(
        {
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        },
        'Products updated successfully'
    );
});


// @desc    Get product preview with full analytics
// @route   GET /api/v1/products/:id/preview
// @access  Private/Admin
export const getProductPreview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id;

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return next(new AppError('Invalid product ID', 400));
    }

    // Fetch product with creator info
    const product = await Product.findById(productId)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    // Calculate total sales and revenue
    const o_productId = new mongoose.Types.ObjectId(productId);
    const salesData = await Order.aggregate(salesReveniuePipeline(o_productId));

    // Calculate sales trend (last 4 months)
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    const salesTrend = await Order.aggregate(salesTrendPipeline(o_productId, fourMonthsAgo) as any);

    // Calculate previous month comparison
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const [lastMonthSales, previousMonthSales] = await Promise.all([
        Order.aggregate(lastMonthSalesPipeline(o_productId, lastMonth, twoMonthsAgo)),
        Order.aggregate(previousMonthSalesPipeline(o_productId, twoMonthsAgo, lastMonth))
    ]);

    // Calculate percentage change
    const currentMonthRevenue = lastMonthSales[0]?.total || 0;
    const previousRevenue = previousMonthSales[0]?.total || 0;
    let percentageChange = 0;

    if (previousRevenue > 0) {
        percentageChange = ((currentMonthRevenue - previousRevenue) / previousRevenue) * 100;
    } else if (currentMonthRevenue > 0) {
        percentageChange = 100;
    }

    // Get stock movement history (last 7 days by default)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const stockHistory = await Order.aggregate(stockHistoryPipeline(o_productId, sevenDaysAgo) as any);

    // Calculate total stock including variants
    const totalStock = product.stockQuantity +
        (product.variants?.reduce((sum, variant) => sum + variant.stockQuantity, 0) || 0);

    // Calculate stock status
    let stockStatus: string;
    if (product.stockQuantity === 0) {
        stockStatus = 'out-of-stock';
    } else if (product.stockQuantity <= product.minimumStockAlert) {
        stockStatus = 'low-stock';
    } else {
        stockStatus = 'in-stock';
    }

    // Format regional distribution data
    const regionalInventory = product.regionalDistribution?.map(region => ({
        region: region.region,
        currentStock: region.mainProduct,
        lastRestocked: null, // You can add this field to schema if needed
        manager: null, // You can add this field to schema if needed
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
            costPerItem: 0, // Add cost field to your schema if needed
            profit: 0, // Calculate based on cost
            grossMargin: 0 // Calculate based on cost and price
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

    (res as AppResponse).data(
        responseData,
        'Product preview retrieved successfully'
    );
});

// @desc    Get stock movement history with filters
// @route   GET /api/v1/products/:id/stock-history
// @access  Private/Admin
export const getStockHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id;
    const { days = 7, limit = 20, page = 1 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return next(new AppError('Invalid product ID', 400));
    }

    const product = await Product.findById(productId);
    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(days));

    const skip = (Number(page) - 1) * Number(limit);

    const stockHistory = await Order.aggregate(
        getStockHistoryPipeline(new mongoose.Types.ObjectId(productId), daysAgo, skip, Number(limit)) as any);

    (res as AppResponse).data(
        {
            history: stockHistory[0].history,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: stockHistory[0].total[0]?.count || 0,
                pages: Math.ceil((stockHistory[0].total[0]?.count || 0) / Number(limit))
            }
        },
        'Stock history retrieved successfully'
    );
});