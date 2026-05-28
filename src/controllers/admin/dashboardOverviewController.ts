import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import dashboardOverviewService, { Period } from '../../services/dashboardOverviewService';
import { resolveStaffRegionId } from '../../helpers/regionScope';

/**
 * Helper to validate and parse period parameter
 */
function parsePeriod(period: string | undefined): Period {
    const validPeriods: Period[] = ["TODAY", "7D", "MTD", "QTD", "YTD", "CUSTOM"];
    if (!period || !validPeriods.includes(period as Period)) {
        return "MTD"; // Default
    }
    return period as Period;
}

/**
 * Helper to parse date parameters
 */
function parseDate(dateStr: string | undefined): Date | undefined {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
}

/**
 * GET /api/v1/admin/dashboard/overview
 *
 * Query params:
 *   regionId     – (optional) force a specific region ObjectId
 *   period       – TODAY, 7D, MTD, QTD, YTD, CUSTOM (default: MTD)
 *   startDate    – (required for CUSTOM period) start date (ISO string)
 *   endDate      – (required for CUSTOM period) end date (ISO string)
 *
 * Response shape:
 * {
 *   stats: { totalSales, completedOrders, activeCustomers, activeDrivers },
 *   revenueChart: [...],
 *   recentOrders: [...],
 *   topProducts: [...],
 *   topCustomers: [...],
 *   regionalPerformance: [...]
 * }
 */
export const getDashboardOverview = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        // Resolve the region scope for this staff member
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

        // Parse period and date parameters
        const period = parsePeriod(req.query.period as string);
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (period === "CUSTOM") {
            startDate = parseDate(req.query.startDate as string);
            endDate = parseDate(req.query.endDate as string);

            if (!startDate || !endDate) {
                return next(new AppError('startDate and endDate are required for CUSTOM period', 400));
            }

            if (startDate > endDate) {
                return next(new AppError('startDate must be before endDate', 400));
            }
        }

        const overview = await dashboardOverviewService.getOverview(
            regionFilter,
            period,
            startDate,
            endDate
        );

        (res as AppResponse).data(
            {
                ...overview,
                scopedToRegion: regionFilter ? regionFilter.toString() : null,
                periodConfig: {
                    period,
                    startDate: startDate?.toISOString() || null,
                    endDate: endDate?.toISOString() || null,
                },
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
 *
 * Query params:
 *   regionId – optional (super-admin only)
 *   period   – TODAY, 7D, MTD, QTD, YTD, CUSTOM (default: MTD)
 *   startDate – required for CUSTOM period
 *   endDate   – required for CUSTOM period
 */
export const getDashboardStats = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const staffRegionId = await resolveStaffRegionId(req.user);
        let regionFilter: mongoose.Types.ObjectId | undefined = staffRegionId ?? undefined;

        if (!staffRegionId && req.query.regionId) {
            const rid = req.query.regionId as string;
            if (!mongoose.Types.ObjectId.isValid(rid)) {
                return next(new AppError('Invalid regionId query parameter', 400));
            }
            regionFilter = new mongoose.Types.ObjectId(rid);
        }

        const period = parsePeriod(req.query.period as string);
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (period === "CUSTOM") {
            startDate = parseDate(req.query.startDate as string);
            endDate = parseDate(req.query.endDate as string);

            if (!startDate || !endDate) {
                return next(new AppError('startDate and endDate are required for CUSTOM period', 400));
            }

            if (startDate > endDate) {
                return next(new AppError('startDate must be before endDate', 400));
            }
        }

        const overview = await dashboardOverviewService.getOverview(
            regionFilter,
            period,
            startDate,
            endDate
        );

        (res as AppResponse).data(
            {
                ...overview.stats,
                periodConfig: { period, startDate, endDate },
                scopedToRegion: regionFilter?.toString() ?? null,
            },
            'Dashboard stats retrieved successfully',
        );
    },
);

/**
 * GET /api/v1/admin/dashboard/revenue-chart
 *
 * Query params:
 *   regionId   – optional (super-admin only)
 *   period     – TODAY, 7D, MTD, QTD, YTD, CUSTOM (default: MTD)
 *   startDate  – required for CUSTOM period (ISO string)
 *   endDate    – required for CUSTOM period (ISO string)
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

        const period = parsePeriod(req.query.period as string);
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (period === "CUSTOM") {
            startDate = parseDate(req.query.startDate as string);
            endDate = parseDate(req.query.endDate as string);

            if (!startDate || !endDate) {
                return next(new AppError('startDate and endDate are required for CUSTOM period', 400));
            }

            if (startDate > endDate) {
                return next(new AppError('startDate must be before endDate', 400));
            }
        }

        const chart = await dashboardOverviewService.getRevenueChart({
            regionFilter,
            period,
            customStartDate: startDate,
            customEndDate: endDate,
        });

        (res as AppResponse).data(
            {
                chart,
                scopedToRegion: regionFilter?.toString() ?? null,
                config: { period, startDate, endDate },
            },
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
 *   limit      – number of products to return (default 10, max 50)
 *   regionId   – optional (super-admin only)
 *   period     – TODAY, 7D, MTD, QTD, YTD, CUSTOM (default: MTD)
 *   startDate  – required for CUSTOM period (ISO string)
 *   endDate    – required for CUSTOM period (ISO string)
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
        
        const period = parsePeriod(req.query.period as string);
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (period === "CUSTOM") {
            startDate = parseDate(req.query.startDate as string);
            endDate = parseDate(req.query.endDate as string);

            if (!startDate || !endDate) {
                return next(new AppError('startDate and endDate are required for CUSTOM period', 400));
            }

            if (startDate > endDate) {
                return next(new AppError('startDate must be before endDate', 400));
            }
        }

        const products = await dashboardOverviewService.getTopProducts({
            limit,
            regionFilter,
            period,
            customStartDate: startDate,
            customEndDate: endDate,
        });

        (res as AppResponse).data(
            {
                products,
                count: products.length,
                scopedToRegion: regionFilter?.toString() ?? null,
                config: { period, startDate, endDate, limit },
            },
            'Top products retrieved successfully',
        );
    },
);

/**
 * GET /api/v1/admin/dashboard/top-customers
 *
 * Query params:
 *   limit      – number of customers to return (default 10, max 50)
 *   regionId   – optional (super-admin only)
 *   period     – TODAY, 7D, MTD, QTD, YTD, CUSTOM (default: MTD)
 *   startDate  – required for CUSTOM period (ISO string)
 *   endDate    – required for CUSTOM period (ISO string)
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
        
        const period = parsePeriod(req.query.period as string);
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (period === "CUSTOM") {
            startDate = parseDate(req.query.startDate as string);
            endDate = parseDate(req.query.endDate as string);

            if (!startDate || !endDate) {
                return next(new AppError('startDate and endDate are required for CUSTOM period', 400));
            }

            if (startDate > endDate) {
                return next(new AppError('startDate must be before endDate', 400));
            }
        }

        const customers = await dashboardOverviewService.getTopCustomers({
            limit,
            regionFilter,
            period,
            customStartDate: startDate,
            customEndDate: endDate,
        });

        (res as AppResponse).data(
            {
                customers,
                count: customers.length,
                scopedToRegion: regionFilter?.toString() ?? null,
                config: { period, startDate, endDate, limit },
            },
            'Top customers retrieved successfully',
        );
    },
);

/**
 * GET /api/v1/admin/dashboard/regional-performance
 *
 * Query params:
 *   period     – TODAY, 7D, MTD, QTD, YTD, CUSTOM (default: MTD)
 *   startDate  – required for CUSTOM period (ISO string)
 *   endDate    – required for CUSTOM period (ISO string)
 */
export const getRegionalPerformance = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const period = parsePeriod(req.query.period as string);
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (period === "CUSTOM") {
            startDate = parseDate(req.query.startDate as string);
            endDate = parseDate(req.query.endDate as string);

            if (!startDate || !endDate) {
                return next(new AppError('startDate and endDate are required for CUSTOM period', 400));
            }

            if (startDate > endDate) {
                return next(new AppError('startDate must be before endDate', 400));
            }
        }

        const regions = await dashboardOverviewService.getRegionalPerformance({
            period,
            customStartDate: startDate,
            customEndDate: endDate,
        });

        (res as AppResponse).data(
            { 
                regions, 
                count: regions.length,
                config: { period, startDate, endDate }
            },
            'Regional performance retrieved successfully',
        );
    },
);