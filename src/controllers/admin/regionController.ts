import { Request, Response, NextFunction } from 'express';
import { AppResponse, AppError, asyncHandler } from '../../middleware/error';
import Region, { IRegion } from '../../models/config/region.model';

export const getAllRegions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const regions = await Region.findActiveRegions();

    (res as AppResponse).data(
         regions,
        'Regions retrieved successfully'
    );
});

export const getRegionsWithCount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const regionsWithCounts = await Region.getRegionsWithProductCount();

    (res as AppResponse).data(
        { regions: regionsWithCounts },
        'Regions with product count retrieved successfully'
    );
});

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

export const createRegion = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
   
    const { name, coordinates } = req.body;

    console.log(req.body)
    const existingRegion = await Region.findByName(name);
    if (existingRegion) {
        return next(new AppError('Region with this name already exists', 400));
    }

    const region = await Region.create({
        name,
        coordinate: {coordinates: coordinates as [number, number]},
        order: req.body.order || 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });

    (res as AppResponse).data(
        { region },
        'Region created successfully',
        201
    );
});

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