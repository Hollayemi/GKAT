import { Request, Response, NextFunction } from 'express';
import { AppResponse, AppError, asyncHandler } from '../../middleware/error';
import Category, { ICategory } from '../../models/config/category.model';

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

// @desc    Create new category
// @route   POST /api/v1/categories
// @access  Private/Admin
export const createCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const { name, icon } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findByName(name);
    if (existingCategory) {
        return next(new AppError('Category with this name already exists', 400));
    }

    const category = await Category.create({
        name,
        icon,
        order: req.body.order || 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });

    (res as AppResponse).data(
        { category },
        'Category created successfully',
        201
    );
});

// @desc    Update category
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