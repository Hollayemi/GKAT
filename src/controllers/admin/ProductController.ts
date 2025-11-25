import { Request, Response, NextFunction } from 'express';
import Product from '../../models/admin/Product';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';

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
        .populate('updatedBy', 'name email');

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    (res as AppResponse).data({ product }, 'Product retrieved successfully');
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