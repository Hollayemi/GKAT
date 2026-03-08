import { Request, Response, NextFunction } from 'express';
import Product from '../../models/admin/Product';
import Order from '../../models/Orders';
import User from '../../models/User';
import Region from '../../models/config/region.model';
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


function haversineDistanceKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371; // Earth radius in km
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

        // Region model stores coordinates as [longitude, latitude] (GeoJSON convention)
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
        sort = '-createdAt',
        lat,       // user latitude  (optional)
        lng,       // user longitude (optional)
        regionId   // explicit region override (optional)
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
        const user = await User.findById(req.user?.id);
        if (user) {
            await user.addSearchHistory(search as string);
        }
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
        // Derive the nearest region from the supplied coordinates
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

    // const products = await Product.find(query)
    //     .populate('category')
    //     .populate('regionalDistribution.region', 'name coordinate')
    //     .sort(sort as string)
    //     .skip(skip)
    //     .limit(limitNum)
    //     .select('-__v');

    console.log('Querying products with:', JSON.stringify(query), `sort: ${sort}`, `skip: ${skip}`, `limit: ${limitNum}`);

    const products = await Product.aggregate(getProductPipeline({query, skip, sort: {[sort as string]: 1 },limitNum}))

    const total = await Product.countDocuments(query).exec();

    const responseData: any = {
        products,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        }
    };

    if (resolvedRegionId) {
        responseData.regionContext = {
            regionId: resolvedRegionId,
            ...(resolvedRegionName && { regionName: resolvedRegionName }),
            ...(distanceKm !== null && { distanceKm: parseFloat(distanceKm.toFixed(2)) })
        };
    }

    (res as AppResponse).data(responseData, 'Products retrieved successfully');
});

// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
export const getProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('regionalDistribution.region', 'name coordinate')
        .lean();

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

// @desc    Create new product with image upload
// @route   POST /api/v1/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    let imageUrls: string[] = [];

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        try {
            imageUrls = await CloudinaryService.uploadMultipleImages(req.files, 'go-kart/products');
        } catch (error: any) {
            return next(new AppError(`Image upload failed: ${error.message}`, 400));
        }
    }

    if (imageUrls.length === 0) {
        return next(new AppError('At least one product image is required', 400));
    }

    req.body.createdBy = req.user.id;
    req.body.images = imageUrls;

    const existingProduct = await Product.findOne({ sku: req.body.sku?.toUpperCase() });
    if (existingProduct) {
        return next(new AppError('Product with this SKU already exists', 409));
    }

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
// @route   PUT /api/v1/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    let product = await Product.findById(req.body._id);

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    if (req.body.sku && req.body.sku.toUpperCase() !== product.sku) {
        const existingProduct = await Product.findOne({ sku: req.body.sku.toUpperCase() });
        if (existingProduct) {
            return next(new AppError('Product with this SKU already exists', 409));
        }
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
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

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
        { products, count: products.length },
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
        { modifiedCount: result.modifiedCount, matchedCount: result.matchedCount },
        'Products updated successfully'
    );
});

// @desc    Set deals of the day
// @route   POST /api/v1/products/deals-of-the-day
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
// @route   GET /api/v1/products/deals-of-the-day
// @access  Public
export const getDealsOfTheDay = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
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
// @route   DELETE /api/v1/products/:id/deals
// @access  Private/Admin
export const removeFromDeals = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $unset: { dealInfo: '', dealsSetAt: '' } },
        { new: true }
    );

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    (res as AppResponse).data({ product }, 'Product removed from deals successfully');
});

// @desc    Get product preview with full analytics
// @route   GET /api/v1/products/:id/preview
// @access  Private/Admin
export const getProductPreview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return next(new AppError('Invalid product ID', 400));
    }

    const product = await Product.findById(productId)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

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
        pricing: {
            salesPrice: product.salesPrice,
            costPerItem: 0,
            profit: 0,
            grossMargin: 0
        },
        inventory: {
            byRegion: regionalInventory,
            stockHistory
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

    (res as AppResponse).data(responseData, 'Product preview retrieved successfully');
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