import { Request, Response, NextFunction } from 'express';
import { AppResponse, AppError, asyncHandler } from '../../middleware/error';
import Category, { ICategory } from '../../models/config/category.model';
import Product from '../../models/admin/Product';
import CloudinaryService from '../../services/cloudinary';

// @desc    Get all categories
// @route   GET /api/v1/categories
// @access  Public
export const getAllCategories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const categories = await Category.findActiveCategories();

    (res as AppResponse).data(
        categories,
        'Categories retrieved successfully'
    );
});

// @desc    Get all categories with product count
// @route   GET /api/v1/categories/with-count
// @access  Public
export const getCategoriesWithCount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const categoriesWithCounts = await Category.getCategoriesWithProductCount();

    (res as AppResponse).data(
        { categories: categoriesWithCounts },
        'Categories with product count retrieved successfully'
    );
});

// @desc    Get single category
// @route   GET /api/v1/categories/:id
// @access  Public
export const getCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
        return next(new AppError('Category not found', 404));
    }

    (res as AppResponse).data(
        { category },
        'Category retrieved successfully'
    );
});

// @desc    Get category with related products
// @route   GET /api/v1/categories/filter/:id
// @access  Public
export const getCategoryWithProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const {
        page = 1,
        limit = 20,
        sort = '-createdAt',
        minPrice,
        maxPrice,
        status = 'active'
    } = req.query;

    const category = await Category.findById(id);

    if (!category) {
        return next(new AppError('Category not found', 404));
    }

    // Build product query
    const productQuery: any = {
        category: id,
        status: status
    };

    // Add price filter if provided
    if (minPrice || maxPrice) {
        productQuery.salesPrice = {};
        if (minPrice) productQuery.salesPrice.$gte = parseFloat(minPrice as string);
        if (maxPrice) productQuery.salesPrice.$lte = parseFloat(maxPrice as string);
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get products for this category
    const [products, totalProducts] = await Promise.all([
        Product.find(productQuery)
        .populate('category')
            .sort(sort as string)
            .skip(skip)
            .limit(limitNum)
            .select('-__v'),
        Product.countDocuments(productQuery)
    ]);

    (res as AppResponse).data(
        {
            category: {
                _id: category._id,
                name: category.name,
                icon: category.icon,
                isActive: category.isActive,
                order: category.order
            },
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalProducts,
                pages: Math.ceil(totalProducts / limitNum)
            }
        },
        'Category with products retrieved successfully'
    );
});

// @desc    Create new category with icon upload
// @route   POST /api/v1/categories
// @access  Private/Admin
export const createCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }

    const { name } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findByName(name);
    if (existingCategory) {
        return next(new AppError('Category with this name already exists', 400));
    }

    // Handle icon upload if provided
    let iconUrl = '';
    if (req.file) {
        try {
            const uploadResult = await CloudinaryService.uploadImage(req.file, 'go-kart/categories');
            iconUrl = uploadResult.url;
        } catch (error: any) {
            return next(new AppError(`Icon upload failed: ${error.message}`, 400));
        }
    }

    const category = await Category.create({
        name,
        icon: iconUrl,
        order: req.body.order || 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });

    (res as AppResponse).data(
        { category },
        'Category created successfully',
        201
    );
});

// @desc    Update category with optional icon upload
// @route   PUT /api/v1/categories/:id
// @access  Private/Admin
export const updateCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }

    const { id } = req.params;
    const updates = req.body;

    if (updates.name) {
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
            _id: { $ne: id }
        });

        if (existingCategory) {
            return next(new AppError('Category with this name already exists', 400));
        }
    }

    // Handle icon upload if new icon is provided
    if (req.file) {
        try {
            const category = await Category.findById(id);
            
            // Delete old icon if exists
            if (category && category.icon) {
                await CloudinaryService.deleteImage(category.icon);
            }

            // Upload new icon
            const uploadResult = await CloudinaryService.uploadImage(req.file, 'go-kart/categories');
            updates.icon = uploadResult.url;
        } catch (error: any) {
            return next(new AppError(`Icon upload failed: ${error.message}`, 400));
        }
    }

    const category = await Category.findByIdAndUpdate(
        id,
        updates,
        {
            new: true,
            runValidators: true
        }
    );

    if (!category) {
        return next(new AppError('Category not found', 404));
    }

    (res as AppResponse).data(
        { category },
        'Category updated successfully'
    );
});

// @desc    Delete category
// @route   DELETE /api/v1/categories/:id
// @access  Private/Admin
export const deleteCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
        return next(new AppError('Category not found', 404));
    }

    // Delete icon from Cloudinary if exists
    if (category.icon) {
        try {
            await CloudinaryService.deleteImage(category.icon);
        } catch (error) {
            console.error('Error deleting category icon:', error);
        }
    }

    await category.deleteOne();

    (res as AppResponse).data(
        null,
        'Category deleted successfully'
    );
});

// @desc    Search categories
// @route   GET /api/v1/categories/search
// @access  Public
export const searchCategories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
        return next(new AppError('Search query is required', 400));
    }

    const categories = await Category.findByPartialName(q);

    (res as AppResponse).data(
        { categories },
        'Categories search completed'
    );
});

// @desc    Toggle category active status
// @route   PATCH /api/v1/categories/:id/toggle-active
// @access  Private/Admin
export const toggleCategoryActive = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
        return next(new AppError('Category not found', 404));
    }

    category.isActive = !category.isActive;
    await category.save();

    const status = category.isActive ? 'activated' : 'deactivated';

    (res as AppResponse).data(
        category,
        `Category ${status} successfully`
    );
});

// @desc    Reorder categories
// @route   PUT /api/v1/categories/reorder
// @access  Private/Admin
export const reorderCategories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const { orderList } = req.body;

    if (!Array.isArray(orderList)) {
        return next(new AppError('Order list must be an array', 400));
    }

    const bulkOps = orderList.map(({ id, order }) => ({
        updateOne: {
            filter: { _id: id },
            update: { order }
        }
    }));

    await Category.bulkWrite(bulkOps);

    const categories = await Category.findActiveCategories();

    (res as AppResponse).data(
        { categories },
        'Categories reordered successfully'
    );
});