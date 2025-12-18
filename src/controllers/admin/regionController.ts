import { Request, Response, NextFunction } from 'express';
import { AppResponse, AppError, asyncHandler } from '../../middleware/error';
import Region, { IRegion } from '../../models/config/region.model';

// @desc    Get all regions
// @route   GET /api/v1/regions
// @access  Public
export const getAllRegions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const regions = await Region.findActiveRegions();

    (res as AppResponse).data(
         regions,
        'Regions retrieved successfully'
    );
});

// @desc    Get all regions with product count
// @route   GET /api/v1/regions/with-count
// @access  Public
export const getRegionsWithCount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const regionsWithCounts = await Region.getRegionsWithProductCount();

    (res as AppResponse).data(
        { regions: regionsWithCounts },
        'Regions with product count retrieved successfully'
    );
});

// @desc    Get single region
// @route   GET /api/v1/regions/:id
// @access  Public
export const getRegion = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const region = await Region.findById(id);

    if (!region) {
        return next(new AppError('Region not found', 404));
    }

    (res as AppResponse).data(
        region,
        'Region retrieved successfully'
    );
});

// @desc    Create new region
// @route   POST /api/v1/regions
// @access  Private/Admin
export const createRegion = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }

    const { name } = req.body;

    // Check if region already exists
    const existingRegion = await Region.findByName(name);
    if (existingRegion) {
        return next(new AppError('Region with this name already exists', 400));
    }

    const region = await Region.create({
        name,
        order: req.body.order || 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });

    (res as AppResponse).data(
        { region },
        'Region created successfully',
        201
    );
});

// @desc    Update region
// @route   PUT /api/v1/regions/:id
// @access  Private/Admin
export const updateRegion = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const { id } = req.params;
    const updates = req.body;

    if (updates.name) {
        const existingRegion = await Region.findOne({
            name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
            _id: { $ne: id }
        });

        if (existingRegion) {
            return next(new AppError('Region with this name already exists', 400));
        }
    }

    const region = await Region.findByIdAndUpdate(
        id,
        updates,
        {
            new: true,
            runValidators: true
        }
    );

    if (!region) {
        return next(new AppError('Region not found', 404));
    }

    (res as AppResponse).data(
        { region },
        'Region updated successfully'
    );
});

// @desc    Delete region
// @route   DELETE /api/v1/regions/:id
// @access  Private/Admin
export const deleteRegion = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const { id } = req.params;

    const region = await Region.findById(id);

    if (!region) {
        return next(new AppError('Region not found', 404));
    }

    await region.deleteOne();

    (res as AppResponse).data(
        null,
        'Region deleted successfully'
    );
});

// @desc    Search regions
// @route   GET /api/v1/regions/search
// @access  Public
export const searchRegions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
        return next(new AppError('Search query is required', 400));
    }

    const regions = await Region.findByPartialName(q);

    (res as AppResponse).data(
        { regions },
        'Regions search completed'
    );
});

// @desc    Toggle region active status
// @route   PATCH /api/v1/regions/:id/toggle-active
// @access  Private/Admin
export const toggleRegionActive = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const { id } = req.params;

    const region = await Region.findById(id);

    if (!region) {
        return next(new AppError('Region not found', 404));
    }

    region.isActive = !region.isActive;
    await region.save();

    const status = region.isActive ? 'activated' : 'deactivated';

    (res as AppResponse).data(
        { region },
        `Region ${status} successfully`
    );
});

// @desc    Reorder regions
// @route   PUT /api/v1/regions/reorder
// @access  Private/Admin
export const reorderRegions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
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

    await Region.bulkWrite(bulkOps);

    const regions = await Region.findActiveRegions();

    (res as AppResponse).data(
        { regions },
        'Regions reordered successfully'
    );
});