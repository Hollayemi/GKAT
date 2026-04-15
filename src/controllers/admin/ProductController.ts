import { Request, Response, NextFunction } from 'express';
import Product from '../../models/admin/Product';
import Order from '../../models/Orders';
import User from '../../models/User';
import Region from '../../models/config/region.model';
import Category from '../../models/config/category.model';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import mongoose from 'mongoose';
import {
    getProductPipeline,
    getStockHistoryPipeline,
    lastMonthSalesPipeline,
    previousMonthSalesPipeline,
    salesReveniuePipeline,
    salesTrendPipeline,
    stockHistoryPipeline
} from './pipeline';
import CloudinaryService from '../../services/cloudinary';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineDistanceKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findNearestRegionId(
    userLat: number,
    userLng: number
): Promise<{ regionId: mongoose.Types.ObjectId; regionName: string; distanceKm: number } | null> {
    const regions = await Region.find({ isActive: true }).lean();
    if (!regions.length) return null;

    let nearest: { regionId: mongoose.Types.ObjectId; regionName: string; distanceKm: number } | null = null;

    for (const region of regions) {
        const coords = region.coordinate?.coordinates;
        if (!coords || coords.length < 2) continue;
        const [regionLng, regionLat] = coords;
        const distanceKm = haversineDistanceKm(userLat, userLng, regionLat, regionLng);
        if (!nearest || distanceKm < nearest.distanceKm) {
            nearest = {
                regionId: region._id as mongoose.Types.ObjectId,
                regionName: region.name,
                distanceKm
            };
        }
    }
    return nearest;
}

/** Generate a unique SKU like GK-XXXXXX */
async function generateUniqueSku(prefix = 'GK'): Promise<string> {
    let sku = '';
    let isUnique = false;
    while (!isUnique) {
        const rand = Math.floor(100000 + Math.random() * 900000);
        sku = `${prefix}-${rand}`;
        const exists = await Product.findOne({ sku });
        if (!exists) isUnique = true;
    }
    return sku;
}

/** Build product overview stats (total, in-stock, low-stock, out-of-stock, categories) */
async function buildProductOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Current counts
    const [
        totalProducts,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        categoryCount,
        // Last-month counts for % change
        lastMonthTotal,
        lastMonthInStock,
        lastMonthLowStock,
        lastMonthOutOfStock,
    ] = await Promise.all([
        Product.countDocuments({}),
        Product.countDocuments({ stockQuantity: { $gt: 10 } }),
        Product.countDocuments({ stockQuantity: { $gt: 0, $lte: 10 } }),
        Product.countDocuments({ stockQuantity: 0 }),
        Product.distinct('category').then(cats => cats.length),

        // Last month snapshots (products created before end of last month)
        Product.countDocuments({ createdAt: { $lte: endOfLastMonth } }),
        Product.countDocuments({ createdAt: { $lte: endOfLastMonth }, stockQuantity: { $gt: 10 } }),
        Product.countDocuments({ createdAt: { $lte: endOfLastMonth }, stockQuantity: { $gt: 0, $lte: 10 } }),
        Product.countDocuments({ createdAt: { $lte: endOfLastMonth }, stockQuantity: 0 }),
    ]);

    const pctChange = (current: number, previous: number): string => {
        if (previous === 0) return current > 0 ? '+100%' : '-';
        const diff = ((current - previous) / previous) * 100;
        return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% vs last month`;
    };

    return {
        totalProducts: {
            value: totalProducts,
            change: pctChange(totalProducts, lastMonthTotal),
            color: 'purple',
        },
        inStock: {
            value: inStockCount,
            change: pctChange(inStockCount, lastMonthInStock),
            color: 'orange',
        },
        lowStock: {
            value: lowStockCount,
            change: pctChange(lowStockCount, lastMonthLowStock),
            color: 'cyan',
        },
        outOfStock: {
            value: outOfStockCount,
            change: pctChange(outOfStockCount, lastMonthOutOfStock),
            color: 'red',
        },
        categories: {
            value: categoryCount,
            change: '- vs last month',
            color: 'blue',
        },
    };
}


// ─── CSV helpers ──────────────────────────────────────────────────────────────

const CSV_TEMPLATE_HEADERS = [
    'productName',
    'sku',
    'productId',
    'brand',
    'category',          // category name (looked up by name)
    'description',
    'salesPrice',
    'unitType',          // single|pack|carton|kg|litre|box
    'unitQuantity',
    'stockQuantity',
    'minimumStockAlert',
    'tags',              // comma-separated inside the cell, e.g. "fresh,organic"
    'status',            // active|inactive|draft
];

function buildCsvRow(product: any): Record<string, string> {
    return {
        productName: product.productName ?? '',
        sku: product.sku ?? '',
        productId: product.productId ?? '',
        brand: product.brand ?? '',
        category: product.category?.name ?? product.category ?? '',
        description: product.description ?? '',
        salesPrice: String(product.salesPrice ?? ''),
        unitType: product.unitType ?? '',
        unitQuantity: String(product.unitQuantity ?? ''),
        stockQuantity: String(product.stockQuantity ?? ''),
        minimumStockAlert: String(product.minimumStockAlert ?? ''),
        tags: Array.isArray(product.tags) ? product.tags.join(',') : '',
        status: product.status ?? 'draft',
    };
}


// ─── Controllers ─────────────────────────────────────────────────────────────

// @desc    Get all products (with overview stats)
// @route   GET /api/v1/product
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
        sort = '-createdAt',
        lat,
        lng,
        regionId,
        includeOverview = 'false',
    } = req.query;

    const query: any = {};

    if (category) query.category = category;

    if (status && (status === 'active' || status === 'inactive')) {
        query.status = status;
    } else {
        query.status = 'active';
    }

    if (status === 'all') {
        delete query.status;
    } else if (status === 'low-stock') {
        query.stockQuantity = { $gt: 0, $lte: 10 };
        delete query.status;
    } else if (status === 'out-of-stock') {
        query.stockQuantity = 0;
        delete query.status;
    }

    if (search) {
        query.$text = { $search: search as string };
        const user = await User.findById(req.user?.id);
        if (user) await user.addSearchHistory(search as string);
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

    let resolvedRegionId: mongoose.Types.ObjectId | null = null;
    let resolvedRegionName: string | null = null;
    let distanceKm: number | null = null;

    if (regionId) {
        if (!mongoose.Types.ObjectId.isValid(regionId as string)) {
            return next(new AppError('Invalid regionId', 400));
        }
        resolvedRegionId = new mongoose.Types.ObjectId(regionId as string);
    } else if (lat && lng) {
        const userLat = parseFloat(lat as string);
        const userLng = parseFloat(lng as string);
        if (isNaN(userLat) || isNaN(userLng)) {
            return next(new AppError('lat and lng must be valid numbers', 400));
        }
        const nearest = await findNearestRegionId(userLat, userLng);
        if (nearest) {
            resolvedRegionId = nearest.regionId;
            resolvedRegionName = nearest.regionName;
            distanceKm = nearest.distanceKm;
        }
    }

    if (resolvedRegionId) {
        query['regionalDistribution'] = {
            $elemMatch: {
                region: resolvedRegionId,
                mainProduct: { $gt: 0 }
            }
        };
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
        Product.aggregate(
            getProductPipeline({ query, skip, sort: { [sort as string]: 1 }, limitNum })
        ),
        Product.countDocuments(query),
    ]);

    const responseData: any = {
        products,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
        },
    };

    if (resolvedRegionId) {
        responseData.regionContext = {
            regionId: resolvedRegionId,
            ...(resolvedRegionName && { regionName: resolvedRegionName }),
            ...(distanceKm !== null && { distanceKm: parseFloat(distanceKm.toFixed(2)) }),
        };
    }

    // Attach overview when explicitly requested OR when on the first page with no heavy filters
    // Frontend can pass ?includeOverview=true on the initial load
    if (includeOverview === 'true') {
        responseData.overview = await buildProductOverview();
    }

    (res as AppResponse).data(responseData, 'Products retrieved successfully');
});


// @desc    Get products overview stats only
// @route   GET /api/v1/product/overview
// @access  Private/Admin
export const getProductsOverview = asyncHandler(async (_req: Request, res: Response) => {
    const overview = await buildProductOverview();
    (res as AppResponse).data(overview, 'Products overview retrieved successfully');
});


// @desc    Get single product
// @route   GET /api/v1/product/:id
// @access  Public
export const getProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('regionalDistribution.region', 'name coordinate')
        .lean();

    if (!product) return next(new AppError('Product not found', 404));

    (res as AppResponse).data({ ...product }, 'Product retrieved successfully');
});


// @desc    Get product by SKU
// @route   GET /api/v1/product/sku/:sku
// @access  Public
export const getProductBySku = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findOne({ sku: req.params.sku.toUpperCase() })
        .populate('createdBy', 'name email');
    if (!product) return next(new AppError('Product not found', 404));
    (res as AppResponse).data({ product }, 'Product retrieved successfully');
});


// @desc    Create new product with image upload
// @route   POST /api/v1/product
// @access  Private/Admin
export const createProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    let imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        try {
            imageUrls = await CloudinaryService.uploadMultipleImages(req.files, 'go-kart/products');
        } catch (error: any) {
            return next(new AppError(`Image upload failed: ${error.message}`, 400));
        }
    }

    if (imageUrls.length === 0) return next(new AppError('At least one product image is required', 400));

    req.body.createdBy = req.user.id;
    req.body.images = imageUrls;

    const existingProduct = await Product.findOne({ sku: req.body.sku?.toUpperCase() });
    if (existingProduct) return next(new AppError('Product with this SKU already exists', 409));

    const product = await Product.create({
        ...req.body,
        salesPrice: parseFloat(req.body.salesPrice),
        variants: JSON.parse(req.body.variants),
        stockQuantity: parseInt(req.body.stockQuantity),
        tags: JSON.parse(req.body.tags),
        regionalDistribution: JSON.parse(req.body.regionDistribution),
    });

    (res as AppResponse).data({ product }, 'Product created successfully', 201);
});


// @desc    Update product with optional image upload
// @route   PUT /api/v1/product
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    let product = await Product.findById(req.body._id);
    if (!product) return next(new AppError('Product not found', 404));

    if (req.body.sku && req.body.sku.toUpperCase() !== product.sku) {
        const existingProduct = await Product.findOne({ sku: req.body.sku.toUpperCase() });
        if (existingProduct) return next(new AppError('Product with this SKU already exists', 409));
    }

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        try {
            if (product.images && product.images.length > 0) {
                await CloudinaryService.deleteMultipleImages(product.images);
            }
            const imageUrls = await CloudinaryService.uploadMultipleImages(req.files, 'go-kart/products');
            req.body.images = [...JSON.parse(req.body.existingImages), ...imageUrls];
        } catch (error: any) {
            return next(new AppError(`Image upload failed: ${error.message}`, 400));
        }
    }

    req.body.updatedBy = req.user.id;
    product = await Product.findByIdAndUpdate(
        req.body._id,
        {
            ...req.body,
            variants: req.body.variants ? JSON.parse(req.body.variants) : product.variants,
            tags: req.body.tags ? JSON.parse(req.body.tags) : product.tags,
        },
        { new: true, runValidators: true }
    );

    (res as AppResponse).data({ product }, 'Product updated successfully');
});


// @desc    Delete product
// @route   DELETE /api/v1/product/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new AppError('Product not found', 404));

    if (product.images && product.images.length > 0) {
        try {
            await CloudinaryService.deleteMultipleImages(product.images);
        } catch (error) {
            console.error('Error deleting product images:', error);
        }
    }

    await product.deleteOne();
    (res as AppResponse).success('Product deleted successfully');
});


// @desc    Update product stock
// @route   PATCH /api/v1/product/:id/stock
// @access  Private/Admin
export const updateStock = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { stockQuantity, variantId, variantStock } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return next(new AppError('Product not found', 404));

    if (stockQuantity !== undefined) {
        if (stockQuantity < 0) return next(new AppError('Stock quantity cannot be negative', 400));
        product.stockQuantity = stockQuantity;
    }

    if (variantId && variantStock !== undefined) {
        const variant = product.variants.find(v => v._id?.toString() === variantId);
        if (!variant) return next(new AppError('Variant not found', 404));
        if (variantStock < 0) return next(new AppError('Stock quantity cannot be negative', 400));
        variant.stockQuantity = variantStock;
    }

    await product.save();
    (res as AppResponse).data({ product }, 'Stock updated successfully');
});


// @desc    Add product variant
// @route   POST /api/v1/product/:id/variants
// @access  Private/Admin
export const addVariant = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new AppError('Product not found', 404));

    const existingVariant = product.variants.find(v => v.sku === req.body.sku?.toUpperCase());
    if (existingVariant) return next(new AppError('Variant with this SKU already exists', 409));

    product.variants.push(req.body);
    await product.save();
    (res as AppResponse).data({ product }, 'Variant added successfully', 201);
});


// @desc    Update product variant
// @route   PUT /api/v1/product/:id/variants/:variantId
// @access  Private/Admin
export const updateVariant = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new AppError('Product not found', 404));

    const variantIndex = product.variants.findIndex(v => v._id?.toString() === req.params.variantId);
    if (variantIndex === -1) return next(new AppError('Variant not found', 404));

    Object.assign(product.variants[variantIndex], req.body);
    await product.save();
    (res as AppResponse).data({ product }, 'Variant updated successfully');
});


// @desc    Delete product variant
// @route   DELETE /api/v1/product/:id/variants/:variantId
// @access  Private/Admin
export const deleteVariant = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new AppError('Product not found', 404));

    const variantIndex = product.variants.findIndex(v => v._id?.toString() === req.params.variantId);
    if (variantIndex === -1) return next(new AppError('Variant not found', 404));

    product.variants.splice(variantIndex, 1);
    await product.save();
    (res as AppResponse).success('Variant deleted successfully');
});


// @desc    Update regional distribution
// @route   PUT /api/v1/product/:id/distribution
// @access  Private/Admin
export const updateRegionalDistribution = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new AppError('Product not found', 404));

    product.regionalDistribution = req.body.regionalDistribution;
    await product.save();
    (res as AppResponse).data({ product }, 'Regional distribution updated successfully');
});


// @desc    Get low stock products
// @route   GET /api/v1/product/low-stock/products
// @access  Private/Admin
export const getLowStockProducts = asyncHandler(async (req: Request, res: Response) => {
    const products = await Product.find({
        $expr: { $lte: ['$stockQuantity', '$minimumStockAlert'] }
    }).populate('createdBy', 'name email');

    (res as AppResponse).data(
        { products, count: products.length },
        'Low stock products retrieved successfully'
    );
});


// @desc    Bulk update products
// @route   PATCH /api/v1/product/bulk-update
// @access  Private/Admin
export const bulkUpdateProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { productIds, updates } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return next(new AppError('Please provide product IDs', 400));
    }
    if (!updates) return next(new AppError('Please provide updates', 400));

    const result = await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: updates }
    );

    (res as AppResponse).data(
        { modifiedCount: result.modifiedCount, matchedCount: result.matchedCount },
        'Products updated successfully'
    );
});


// @desc    Set deals of the day
// @route   POST /api/v1/product/deals-of-the-day
// @access  Private/Admin
export const setDealsOfTheDay = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { productId, percentage, startDate, endDate, status = 'active' } = req.body;

    if (!productId || !percentage || !startDate || !endDate) {
        return next(new AppError('Please provide all required fields', 400));
    }

    const result = await Product.updateOne(
        { _id: productId, status: 'active' },
        { $set: { dealInfo: { percentage, startDate, endDate, status }, dealsSetAt: new Date() } }
    );

    const dealsProducts = await Product.find({
        dealInfo: { $exists: true },
        'dealInfo.status': 'active',
        status: 'active'
    }).populate('category');

    (res as AppResponse).data(
        { products: dealsProducts, count: result.modifiedCount },
        'Deal of the day set successfully'
    );
});


// @desc    Get deals of the day
// @route   GET /api/v1/product/deals/deals-of-the-day
// @access  Public
export const getDealsOfTheDay = asyncHandler(async (req: Request, res: Response) => {
    const { limit = 10 } = req.query;
    const deals = await Product.find({
        'dealInfo.status': 'active',
        status: 'active',
        stockQuantity: { $gt: 0 }
    })
        .sort({ dealsSetAt: -1 })
        .limit(parseInt(limit as string));

    (res as AppResponse).data(
        { deals, count: deals.length },
        'Deals of the day retrieved successfully'
    );
});


// @desc    Remove product from deals
// @route   DELETE /api/v1/product/:id/deals
// @access  Private/Admin
export const removeFromDeals = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $unset: { dealInfo: '', dealsSetAt: '' } },
        { new: true }
    );
    if (!product) return next(new AppError('Product not found', 404));
    (res as AppResponse).data({ product }, 'Product removed from deals successfully');
});


// @desc    Get product preview with full analytics
// @route   GET /api/v1/product/:id/preview
// @access  Private/Admin
export const getProductPreview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) return next(new AppError('Invalid product ID', 400));

    const product = await Product.findById(productId)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('category', 'name icon')
        .populate('regionalDistribution.region', 'name coordinate isActive');

    if (!product) return next(new AppError('Product not found', 404));

    const o_productId = new mongoose.Types.ObjectId(productId);
    const salesData = await Order.aggregate(salesReveniuePipeline(o_productId));

    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const salesTrend = await Order.aggregate(salesTrendPipeline(o_productId, fourMonthsAgo) as any);

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const [lastMonthSales, previousMonthSales] = await Promise.all([
        Order.aggregate(lastMonthSalesPipeline(o_productId, lastMonth, twoMonthsAgo)),
        Order.aggregate(previousMonthSalesPipeline(o_productId, twoMonthsAgo, lastMonth))
    ]);

    const currentMonthRevenue = lastMonthSales[0]?.total || 0;
    const previousRevenue = previousMonthSales[0]?.total || 0;
    let percentageChange = 0;
    if (previousRevenue > 0) {
        percentageChange = ((currentMonthRevenue - previousRevenue) / previousRevenue) * 100;
    } else if (currentMonthRevenue > 0) {
        percentageChange = 100;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const stockHistory = await Order.aggregate(stockHistoryPipeline(o_productId, sevenDaysAgo) as any);

    const totalStock =
        product.stockQuantity +
        (product.variants?.reduce((sum, variant) => sum + variant.stockQuantity, 0) || 0);

    let stockStatus: string;
    if (product.stockQuantity === 0) {
        stockStatus = 'out-of-stock';
    } else if (product.stockQuantity <= product.minimumStockAlert) {
        stockStatus = 'low-stock';
    } else {
        stockStatus = 'in-stock';
    }

    const regionalInventory = product.regionalDistribution?.map(region => ({
        region: region.region,
        currentStock: region.mainProduct,
        lastRestocked: null,
        manager: null,
        status:
            region.mainProduct === 0 ? 'Out of Stock' :
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
            salesPrice: product.salesPrice,
            unitType: product.unitType,
            unitQuantity: product.unitQuantity,
            stockQuantity: product.stockQuantity,
            totalStock,
            minimumStockAlert: product.minimumStockAlert,
            stockStatus,
            variants: product.variants,
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
        pricing: { salesPrice: product.salesPrice, costPerItem: 0, profit: 0, grossMargin: 0 },
        inventory: { byRegion: regionalInventory, stockHistory },
        overview: {
            sku: product.sku,
            category: product.category,
            stockLevel: `${product.stockQuantity} ${product.unitType}${product.stockQuantity !== 1 ? 's' : ''} remaining`,
            weightQuantity: `1 ${product.unitType} (~${product.unitQuantity})`,
            availabilityStatus: product.status,
            tags: product.tags
        }
    };

    (res as AppResponse).data(responseData, 'Product preview retrieved successfully');
});


// @desc    Get stock movement history with filters
// @route   GET /api/v1/product/:id/stock-history
// @access  Private/Admin
export const getStockHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id;
    const { days = 7, limit = 20, page = 1 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) return next(new AppError('Invalid product ID', 400));

    const product = await Product.findById(productId);
    if (!product) return next(new AppError('Product not found', 404));

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(days));

    const skip = (Number(page) - 1) * Number(limit);
    const stockHistory = await Order.aggregate(
        getStockHistoryPipeline(
            new mongoose.Types.ObjectId(productId),
            daysAgo,
            skip,
            Number(limit)
        ) as any
    );

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


// ─── CSV Import ───────────────────────────────────────────────────────────────

// @desc    Download CSV import template
// @route   GET /api/v1/product/import/template
// @access  Private/Admin
export const downloadImportTemplate = asyncHandler(async (_req: Request, res: Response) => {
    // Build one example row so admins know what values are expected
    const exampleRow: Record<string, string> = {
        productName: 'Indomie Instant Noodles',
        sku: '',                  // leave blank → auto-generated
        productId: '',            // leave blank → auto-generated
        brand: 'De-United Foods',
        category: 'Food & Beverages',
        description: 'A pack of 40 indomie chicken flavour noodles.',
        salesPrice: '3500',
        unitType: 'pack',         // single|pack|carton|kg|litre|box
        unitQuantity: '40',
        stockQuantity: '200',
        minimumStockAlert: '20',
        tags: 'noodles,instant,food',
        status: 'active',         // active|inactive|draft
    };

    const csv = stringify([exampleRow], {
        header: true,
        columns: CSV_TEMPLATE_HEADERS,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product_import_template.csv"');
    res.status(200).send(csv);
});


// @desc    Import products from CSV
// @route   POST /api/v1/product/import
// @access  Private/Admin
// Expects: multipart/form-data with a single "file" field (CSV file)
export const importProductsFromCsv = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    if (!req.file) return next(new AppError('Please upload a CSV file', 400));

    let rows: Record<string, string>[];
    try {
        rows = parse(req.file.buffer, {
            columns: true,          // first row = headers
            skip_empty_lines: true,
            trim: true,
        });
    } catch (err: any) {
        return next(new AppError(`CSV parse error: ${err.message}`, 400));
    }

    if (!rows.length) return next(new AppError('CSV file is empty', 400));

    // Validate required fields present in headers
    const requiredHeaders = ['productName', 'salesPrice', 'unitType', 'unitQuantity', 'stockQuantity', 'description'];
    const csvHeaders = Object.keys(rows[0]);
    const missingHeaders = requiredHeaders.filter(h => !csvHeaders.includes(h));
    if (missingHeaders.length) {
        return next(new AppError(`Missing required CSV columns: ${missingHeaders.join(', ')}`, 400));
    }

    // Build a category name → ObjectId cache for the batch
    const categoryCache: Map<string, string> = new Map();

    const created: any[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // 1-indexed + header row

        try {
            // ── Resolve / generate SKU ──────────────────────────────────────
            let sku = row.sku?.trim().toUpperCase();
            if (!sku) {
                sku = await generateUniqueSku('GK');
            } else {
                // Check uniqueness
                const exists = await Product.findOne({ sku });
                if (exists) {
                    errors.push({ row: rowNum, message: `SKU "${sku}" already exists — skipped` });
                    continue;
                }
            }

            // ── Resolve category ────────────────────────────────────────────
            const categoryName = row.category?.trim();
            let categoryId: string | undefined;
            if (categoryName) {
                if (categoryCache.has(categoryName)) {
                    categoryId = categoryCache.get(categoryName)!;
                } else {
                    const cat = await Category.findOne({
                        name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
                    });
                    if (!cat) {
                        errors.push({ row: rowNum, message: `Category "${categoryName}" not found — row skipped` });
                        continue;
                    }
                    categoryCache.set(categoryName, cat._id.toString());
                    categoryId = cat._id.toString();
                }
            }

            // ── Validate required fields ─────────────────────────────────────
            const productName = row.productName?.trim();
            if (!productName) {
                errors.push({ row: rowNum, message: 'productName is required' });
                continue;
            }

            const salesPrice = parseFloat(row.salesPrice);
            if (isNaN(salesPrice) || salesPrice < 0) {
                errors.push({ row: rowNum, message: 'salesPrice must be a valid positive number' });
                continue;
            }

            const stockQuantity = parseInt(row.stockQuantity);
            if (isNaN(stockQuantity) || stockQuantity < 0) {
                errors.push({ row: rowNum, message: 'stockQuantity must be a valid non-negative integer' });
                continue;
            }

            const validUnitTypes = ['single', 'pack', 'carton', 'kg', 'litre', 'box'];
            const unitType = row.unitType?.trim().toLowerCase();
            if (!validUnitTypes.includes(unitType)) {
                errors.push({ row: rowNum, message: `unitType must be one of: ${validUnitTypes.join(', ')}` });
                continue;
            }

            const validStatuses = ['active', 'inactive', 'draft'];
            const status = row.status?.trim().toLowerCase() || 'draft';
            if (!validStatuses.includes(status)) {
                errors.push({ row: rowNum, message: `status must be one of: ${validStatuses.join(', ')}` });
                continue;
            }

            // ── Build product doc ───────────────────────────────────────────
            const productDoc: any = {
                productName,
                sku,
                brand: row.brand?.trim() || undefined,
                category: categoryId,
                description: row.description?.trim() || `${productName} — imported from CSV`,
                salesPrice,
                unitType,
                unitQuantity: parseFloat(row.unitQuantity) || 1,
                stockQuantity,
                minimumStockAlert: parseInt(row.minimumStockAlert) || 20,
                tags: row.tags
                    ? row.tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
                    : [],
                status,
                images: [], // no images via CSV; must be added manually
                createdBy: req.user.id,
                variants: [],
                regionalDistribution: [],
            };

            // Override productId if provided; otherwise the model pre-save hook generates it
            if (row.productId?.trim()) {
                const pidExists = await Product.findOne({ productId: row.productId.trim() });
                if (pidExists) {
                    errors.push({ row: rowNum, message: `productId "${row.productId.trim()}" already exists — skipped` });
                    continue;
                }
                productDoc.productId = row.productId.trim();
            }

            const newProduct = await Product.create(productDoc);
            created.push({ _id: newProduct._id, sku: newProduct.sku, productId: newProduct.productId, productName: newProduct.productName });

        } catch (err: any) {
            errors.push({ row: rowNum, message: err.message || 'Unknown error' });
        }
    }

    (res as AppResponse).data(
        {
            imported: created.length,
            failed: errors.length,
            created,
            errors,
        },
        `Import complete. ${created.length} product(s) imported, ${errors.length} row(s) failed.`,
        201
    );
});


// ─── CSV Export ───────────────────────────────────────────────────────────────

// @desc    Export products as CSV (format matches import template)
// @route   GET /api/v1/product/export
// @access  Private/Admin
export const exportProductsToCsv = asyncHandler(async (req: Request, res: Response) => {
    const {
        status,
        category,
        search,
        minPrice,
        maxPrice,
    } = req.query;

    console.log('Exporting products with filters:', req.query);

    const query: any = {};
    if (status && status !== 'all') query.status = status;
    if (category) query.category = category;
    if (search) query.$text = { $search: search as string };
    if (minPrice || maxPrice) {
        query.salesPrice = {};
        if (minPrice) query.salesPrice.$gte = parseFloat(minPrice as string);
        if (maxPrice) query.salesPrice.$lte = parseFloat(maxPrice as string);
    }

    const products = await Product.find(query)
        .populate('category', 'name')
        .lean();

    console.log(`Exporting ${products.length} products to CSV with filters:`, req.query);

    const rows = products.map(buildCsvRow);

    const csv = stringify(rows, {
        header: true,
        columns: CSV_TEMPLATE_HEADERS,
    });

    const filename = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
});