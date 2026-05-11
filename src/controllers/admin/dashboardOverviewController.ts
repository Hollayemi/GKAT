import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import dashboardOverviewService from '../../services/dashboardOverviewService';
import { resolveStaffRegionId } from '../../helpers/regionScope';

/**
 * GET /api/v1/admin/dashboard/overview
 *
 * Query params:
 *   regionId  – (optional) force a specific region ObjectId
 *               Super-admins can pass any regionId; regional staff are
 *               automatically scoped to their own region.
 *
 * Response shape:
 * {
 *   stats: { totalSales, completedOrders, activeCustomers, activeDrivers },
 *   revenueChart: [...],       // last 12 months
 *   recentOrders:  [...],      // last 10 orders
 *   topProducts:   [...],      // top 10 by units sold (last 30 days)
 *   topCustomers:  [...],      // top 10 by total spend
 *   regionalPerformance: [...] // all regions
 * }
 */
export const getDashboardOverview = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        // Resolve the region scope for this staff member
        // - super_admin    → null  (no restriction, sees all)
        // - regional staff → their assigned region ObjectId
        const staffRegionId = await resolveStaffRegionId(req.user);

        // Super-admins may optionally filter by a specific regionId from the query string
        let regionFilter: mongoose.Types.ObjectId | undefined;

        if (staffRegionId) {
            // Non-super-admin: always scoped to their region
            regionFilter = staffRegionId;
        } else if (req.query.regionId) {
            // Super-admin chose a specific region
            const rid = req.query.regionId as string;
            if (!mongoose.Types.ObjectId.isValid(rid)) {
                return next(new AppError('Invalid regionId query parameter', 400));
            }
            regionFilter = new mongoose.Types.ObjectId(rid);
        }

        const overview = await dashboardOverviewService.getOverview(regionFilter);

        (res as AppResponse).data(
            {
                ...overview,
                scopedToRegion: regionFilter ? regionFilter.toString() : null,
            },
            'Dashboard overview retrieved successfully',
        );
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// Granular endpoints (useful for lazy-loading individual dashboard sections)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/dashboard/stats
 */
export const getDashboardStats = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const staffRegionId = await resolveStaffRegionId(req.user);
        const regionFilter = staffRegionId ?? undefined;

        const overview = await dashboardOverviewService.getOverview(regionFilter);

        (res as AppResponse).data(overview.stats, 'Dashboard stats retrieved successfully');
    },
);

/**
 * GET /api/v1/admin/dashboard/revenue-chart
 *
 * Query params:
 *   regionId – optional (super-admin only)
 */
export const getRevenueChart = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const staffRegionId = await resolveStaffRegionId(req.user);

        let regionFilter: mongoose.Types.ObjectId | undefined;
        if (staffRegionId) {
            regionFilter = staffRegionId;
        } else if (req.query.regionId) {
            const rid = req.query.regionId as string;
            if (!mongoose.Types.ObjectId.isValid(rid)) {
                return next(new AppError('Invalid regionId query parameter', 400));
            }
            regionFilter = new mongoose.Types.ObjectId(rid);
        }

        const chart = await dashboardOverviewService.getRevenueChart(regionFilter);

        (res as AppResponse).data(
            { chart, scopedToRegion: regionFilter?.toString() ?? null },
            'Revenue chart data retrieved successfully',
        );
    },
);

/**
 * GET /api/v1/admin/dashboard/recent-orders
 *
 * Query params:
 *   limit    – number of orders to return (default 10, max 50)
 *   regionId – optional (super-admin only)
 */
export const getRecentOrders = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const staffRegionId = await resolveStaffRegionId(req.user);

        let regionFilter: mongoose.Types.ObjectId | undefined;
        if (staffRegionId) {
            regionFilter = staffRegionId;
        } else if (req.query.regionId) {
            const rid = req.query.regionId as string;
            if (!mongoose.Types.ObjectId.isValid(rid)) {
                return next(new AppError('Invalid regionId query parameter', 400));
            }
            regionFilter = new mongoose.Types.ObjectId(rid);
        }

        const rawLimit = parseInt(req.query.limit as string) || 10;
        const limit = Math.min(Math.max(rawLimit, 1), 50);

        const orders = await dashboardOverviewService.getRecentOrders(limit, regionFilter);

        (res as AppResponse).data(
            {
                orders,
                count: orders.length,
                scopedToRegion: regionFilter?.toString() ?? null,
            },
            'Recent orders retrieved successfully',
        );
    },
);

/**
 * GET /api/v1/admin/dashboard/top-products
 *
 * Query params:
 *   limit    – number of products to return (default 10, max 50)
 *   regionId – optional (super-admin only)
 */
export const getTopProducts = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const staffRegionId = await resolveStaffRegionId(req.user);

        let regionFilter: mongoose.Types.ObjectId | undefined;
        if (staffRegionId) {
            regionFilter = staffRegionId;
        } else if (req.query.regionId) {
            const rid = req.query.regionId as string;
            if (!mongoose.Types.ObjectId.isValid(rid)) {
                return next(new AppError('Invalid regionId query parameter', 400));
            }
            regionFilter = new mongoose.Types.ObjectId(rid);
        }

        const rawLimit = parseInt(req.query.limit as string) || 10;
        const limit = Math.min(Math.max(rawLimit, 1), 50);

        const products = await dashboardOverviewService.getTopProducts(limit, regionFilter);

        (res as AppResponse).data(
            {
                products,
                count: products.length,
                scopedToRegion: regionFilter?.toString() ?? null,
            },
            'Top products retrieved successfully',
        );
    },
);

/**
 * GET /api/v1/admin/dashboard/top-customers
 *
 * Query params:
 *   limit    – number of customers to return (default 10, max 50)
 *   regionId – optional (super-admin only)
 */
export const getTopCustomers = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const staffRegionId = await resolveStaffRegionId(req.user);

        let regionFilter: mongoose.Types.ObjectId | undefined;
        if (staffRegionId) {
            regionFilter = staffRegionId;
        } else if (req.query.regionId) {
            const rid = req.query.regionId as string;
            if (!mongoose.Types.ObjectId.isValid(rid)) {
                return next(new AppError('Invalid regionId query parameter', 400));
            }
            regionFilter = new mongoose.Types.ObjectId(rid);
        }

        const rawLimit = parseInt(req.query.limit as string) || 10;
        const limit = Math.min(Math.max(rawLimit, 1), 50);

        const customers = await dashboardOverviewService.getTopCustomers(limit, regionFilter);

        (res as AppResponse).data(
            {
                customers,
                count: customers.length,
                scopedToRegion: regionFilter?.toString() ?? null,
            },
            'Top customers retrieved successfully',
        );
    },
);

/**
 * GET /api/v1/admin/dashboard/regional-performance
 */
export const getRegionalPerformance = asyncHandler(
    async (_req: Request, res: Response, _next: NextFunction) => {
        const regions = await dashboardOverviewService.getRegionalPerformance();

        (res as AppResponse).data(
            { regions, count: regions.length },
            'Regional performance retrieved successfully',
        );
    },
);
