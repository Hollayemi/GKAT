import mongoose from 'mongoose';
import Order from '../models/Orders';
import User from '../models/User';
import Product from '../models/admin/Product';
import Driver from '../models/Driver';
import Region from '../models/config/region.model';
import { generateDatePeriods, getWeekNumber } from '../utils/function';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type Period = "TODAY" | "7D" | "MTD" | "QTD" | "YTD" | "CUSTOM";

export interface StatCard {
    label: string;
    value: string | number;
    rawValue: number;
    change: string;           // e.g. "+12.3"  (no %)
    positive: boolean;
    sparkline: { value: number }[];
}

export interface RevenueChartPoint {
    label: string;            // "Jan 2025"
    revenue: number;
    orders: number;
}

export interface OrderRow {
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    region: string;
    status: string;
    amount: number;
    deliveryMethod: string;
    createdAt: Date;
}

export interface TopProductRow {
    productId: string;
    productName: string;
    sku: string;
    category: string;
    unitsSold: number;
    revenue: number;
}

export interface TopCustomerRow {
    userId: string;
    customerId: string;
    name: string;
    email: string;
    phone: string;
    region: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderAt: Date | null;
}

export interface RegionalRow {
    regionId: string;
    name: string;
    totalOrders: number;
    totalRevenue: number;
    percent: number;          // % of all orders
}

export interface DashboardOverview {
    stats: {
        totalSales: StatCard;
        completedOrders: StatCard;
        activeCustomers: StatCard;
        activeDrivers: StatCard;
    };
    revenueChart: RevenueChartPoint[];
    recentOrders: OrderRow[];
    topProducts: TopProductRow[];
    topCustomers: TopCustomerRow[];
    regionalPerformance: RegionalRow[];
}

export interface PeriodRange {
    start: Date;
    end: Date;
}

export interface GetRevenueChartParams {
    regionFilter?: mongoose.Types.ObjectId;
    period: Period;
    customStartDate?: Date;
    customEndDate?: Date;
}

export interface GetTopProductsParams {
    limit?: number;
    regionFilter?: mongoose.Types.ObjectId;
    period: Period;
    customStartDate?: Date;
    customEndDate?: Date;
}

export interface GetTopCustomersParams {
    limit?: number;
    regionFilter?: mongoose.Types.ObjectId;
    period: Period;
    customStartDate?: Date;
    customEndDate?: Date;
}

export interface GetRegionalPerformanceParams {
    period: Period;
    customStartDate?: Date;
    customEndDate?: Date;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function monthRange(year: number, month: number) {
    return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59, 999),
    };
}

/** Returns [start, end) for a calendar month – safe to use in $gte/$lt pairs */
function monthBounds(year: number, month: number) {
    return {
        gte: new Date(year, month, 1),
        lt: new Date(year, month + 1, 1),
    };
}

function pctChange(current: number, previous: number): string {
    if (previous === 0) return current > 0 ? '+100.0' : '0.0';
    const diff = ((current - previous) / previous) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`;
}

/**
 * Get date range based on period type
 */
function getPeriodRange(
    period: Period,
    now: Date = new Date(),
    customStart?: Date,
    customEnd?: Date
): { current: PeriodRange; previous: PeriodRange } {
    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
        case "TODAY":
            currentStart = startOfDay(now);
            currentEnd = endOfDay(now);
            previousStart = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
            previousEnd = endOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
            break;

        case "7D":
            currentStart = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
            currentEnd = endOfDay(now);
            previousStart = startOfDay(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
            previousEnd = endOfDay(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000));
            break;

        case "MTD":
            currentStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
            currentEnd = endOfDay(now);
            previousStart = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
            previousEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
            break;

        case "QTD": {
            const quarter = Math.floor(now.getMonth() / 3);
            currentStart = startOfDay(new Date(now.getFullYear(), quarter * 3, 1));
            currentEnd = endOfDay(now);
            const prevQuarterStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
            previousStart = startOfDay(prevQuarterStart);
            previousEnd = endOfDay(new Date(now.getFullYear(), quarter * 3, 0));
            break;
        }

        case "YTD":
            currentStart = startOfDay(new Date(now.getFullYear(), 0, 1));
            currentEnd = endOfDay(now);
            previousStart = startOfDay(new Date(now.getFullYear() - 1, 0, 1));
            previousEnd = endOfDay(new Date(now.getFullYear() - 1, 11, 31));
            break;

        case "CUSTOM":
            if (!customStart || !customEnd) {
                throw new Error("Custom period requires start and end dates");
            }
            currentStart = startOfDay(customStart);
            currentEnd = endOfDay(customEnd);
            const duration = currentEnd.getTime() - currentStart.getTime();
            previousStart = startOfDay(new Date(currentStart.getTime() - duration));
            previousEnd = endOfDay(new Date(currentEnd.getTime() - duration));
            break;

        default:
            throw new Error(`Invalid period: ${period}`);
    }

    return {
        current: { start: currentStart, end: currentEnd },
        previous: { start: previousStart, end: previousEnd },
    };
}

/**
 * Get date range for chart data based on period
 */
function getChartDateRange(
    period: Period,
    now: Date = new Date(),
    customStart?: Date,
    customEnd?: Date
): { start: Date; end: Date } {
    let start: Date;
    let end: Date = endOfDay(now);

    switch (period) {
        case "TODAY":
            start = startOfDay(now);
            break;
        case "7D":
            start = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
            break;
        case "MTD":
            start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
            break;
        case "QTD": {
            const quarter = Math.floor(now.getMonth() / 3);
            start = startOfDay(new Date(now.getFullYear(), quarter * 3, 1));
            break;
        }
        case "YTD":
            start = startOfDay(new Date(now.getFullYear(), 0, 1));
            break;
        case "CUSTOM":
            if (!customStart || !customEnd) {
                throw new Error("Custom period requires start and end dates");
            }
            start = startOfDay(customStart);
            end = endOfDay(customEnd);
            break;
        default:
            throw new Error(`Invalid period: ${period}`);
    }

    return { start, end };
}

/**
 * Get appropriate interval based on period
 */
function getIntervalFromPeriod(period: Period): 'daily' | 'weekly' | 'monthly' | 'yearly' {
    switch (period) {
        case "TODAY":
            return 'daily';
        case "7D":
            return 'daily';
        case "MTD":
            return 'daily';
        case "QTD":
            return 'weekly';
        case "YTD":
            return 'monthly';
        case "CUSTOM":
            return 'daily';
        default:
            return 'monthly';
    }
}

export class DashboardOverviewService {

    private async buildSalesStatCard(
        currentRange: PeriodRange,
        previousRange: PeriodRange,
        regionFilter?: mongoose.Types.ObjectId,
    ): Promise<StatCard> {
        const matchBase: any = { orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] } };
        if (regionFilter) matchBase.region = regionFilter;

        const [currentAgg, previousAgg, sparkRaw] = await Promise.all([
            Order.aggregate([
                { $match: { ...matchBase, createdAt: { $gte: currentRange.start, $lte: currentRange.end } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ]),
            Order.aggregate([
                { $match: { ...matchBase, createdAt: { $gte: previousRange.start, $lte: previousRange.end } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ]),
            Order.aggregate([
                {
                    $match: {
                        ...matchBase,
                        createdAt: {
                            $gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
                            $lte: new Date(),
                        },
                    },
                },
                { $group: { _id: { $dayOfMonth: '$createdAt' }, total: { $sum: '$totalAmount' } } },
                { $sort: { '_id': 1 } },
            ]),
        ]);

        const current = currentAgg[0]?.total ?? 0;
        const previous = previousAgg[0]?.total ?? 0;
        const change = pctChange(current, previous);

        return {
            label: 'Total Sales',
            value: `₦${current.toLocaleString()}`,
            rawValue: current,
            change,
            positive: parseFloat(change) >= 0,
            sparkline: sparkRaw.map(r => ({ value: r.total })),
        };
    }

    private async buildOrdersStatCard(
        currentRange: PeriodRange,
        previousRange: PeriodRange,
        regionFilter?: mongoose.Types.ObjectId,
    ): Promise<StatCard> {
        const matchBase: any = { orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] } };
        if (regionFilter) matchBase.region = regionFilter;

        const [current, previous, sparkRaw] = await Promise.all([
            Order.countDocuments({ ...matchBase, createdAt: { $gte: currentRange.start, $lte: currentRange.end } }),
            Order.countDocuments({ ...matchBase, createdAt: { $gte: previousRange.start, $lte: previousRange.end } }),
            Order.aggregate([
                {
                    $match: {
                        ...matchBase,
                        createdAt: { $gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), $lte: new Date() },
                    },
                },
                { $group: { _id: { $dayOfMonth: '$createdAt' }, count: { $sum: 1 } } },
                { $sort: { '_id': 1 } },
            ]),
        ]);

        const change = pctChange(current, previous);
        return {
            label: 'Completed Orders',
            value: current.toLocaleString(),
            rawValue: current,
            change,
            positive: parseFloat(change) >= 0,
            sparkline: sparkRaw.map(r => ({ value: r.count })),
        };
    }

    private async buildCustomersStatCard(
        currentRange: PeriodRange,
        previousRange: PeriodRange,
        regionFilter?: mongoose.Types.ObjectId,
    ): Promise<StatCard> {
        const orderMatch: any = {};
        if (regionFilter) orderMatch.region = regionFilter;

        const [currentIds, previousIds, sparkRaw] = await Promise.all([
            Order.distinct('userId', { ...orderMatch, createdAt: { $gte: currentRange.start, $lte: currentRange.end } }),
            Order.distinct('userId', { ...orderMatch, createdAt: { $gte: previousRange.start, $lte: previousRange.end } }),
            Order.aggregate([
                {
                    $match: {
                        ...orderMatch,
                        createdAt: { $gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), $lte: new Date() },
                    },
                },
                { $group: { _id: { $dayOfMonth: '$createdAt' }, uniqueUsers: { $addToSet: '$userId' } } },
                { $project: { count: { $size: '$uniqueUsers' } } },
                { $sort: { '_id': 1 } },
            ]),
        ]);

        const current = currentIds.length;
        const previous = previousIds.length;
        const change = pctChange(current, previous);

        return {
            label: 'Active Customers',
            value: current.toLocaleString(),
            rawValue: current,
            change,
            positive: parseFloat(change) >= 0,
            sparkline: sparkRaw.map(r => ({ value: r.count })),
        };
    }

    private async buildDriversStatCard(): Promise<StatCard> {
        const [current, previous] = await Promise.all([
            Driver.countDocuments({ status: 'active', verificationStatus: 'verified' }),
            Driver.countDocuments({
                status: 'active',
                verificationStatus: 'verified',
                createdAt: { $lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            }),
        ]);

        const sparkRaw = await Driver.aggregate([
            { $match: { status: 'active', verificationStatus: 'verified' } },
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id': 1 } },
            { $limit: 7 },
        ]);

        const change = pctChange(current, previous);
        return {
            label: 'Active Drivers',
            value: current.toLocaleString(),
            rawValue: current,
            change,
            positive: parseFloat(change) >= 0,
            sparkline: sparkRaw.map(r => ({ value: r.count })),
        };
    }

    async getRevenueChart(params: GetRevenueChartParams): Promise<RevenueChartPoint[]> {
        const { regionFilter, period, customStartDate, customEndDate } = params;
        const now = new Date();
        const { start, end } = getChartDateRange(period, now, customStartDate, customEndDate);
        const interval = getIntervalFromPeriod(period);

        const matchBase: any = {
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
            createdAt: { $gte: start, $lte: end },
        };
        if (regionFilter) matchBase.region = regionFilter;

        // Define grouping based on interval
        let groupId: any;

        switch (interval) {
            case 'daily':
                groupId = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
                break;
            case 'weekly':
                groupId = {
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                };
                break;
            case 'monthly':
                groupId = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
                break;
            case 'yearly':
                groupId = {
                    year: { $year: '$createdAt' }
                };
                break;
            default:
                throw new Error(`Invalid interval: ${interval}`);
        }

        // Execute aggregation
        const raw = await Order.aggregate([
            { $match: matchBase },
            {
                $group: {
                    _id: groupId,
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
        ]);

        // Generate all periods between start and end dates
        const periods = generateDatePeriods(start, end, interval);

        // Map results to periods
        const result: RevenueChartPoint[] = periods.map(periodItem => {
            let found;

            if (interval === 'daily') {
                found = raw.find(r =>
                    r._id.year === periodItem.date.getFullYear() &&
                    r._id.month === periodItem.date.getMonth() + 1 &&
                    r._id.day === periodItem.date.getDate()
                );
            } else if (interval === 'weekly') {
                const weekNum = getWeekNumber(periodItem.date);
                found = raw.find(r =>
                    r._id.year === periodItem.date.getFullYear() &&
                    r._id.week === weekNum
                );
            } else if (interval === 'monthly') {
                found = raw.find(r =>
                    r._id.year === periodItem.date.getFullYear() &&
                    r._id.month === periodItem.date.getMonth() + 1
                );
            } else { // yearly
                found = raw.find(r => r._id.year === periodItem.date.getFullYear());
            }

            return {
                label: periodItem.label,
                revenue: found?.revenue ?? 0,
                orders: found?.orders ?? 0,
            };
        });

        return result;
    }

    async getTopProducts(params: GetTopProductsParams): Promise<TopProductRow[]> {
        const { 
            limit = 10, 
            regionFilter, 
            period,
            customStartDate,
            customEndDate 
        } = params;
        
        const now = new Date();
        const { start, end } = getChartDateRange(period, now, customStartDate, customEndDate);

        const matchBase: any = {
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
            createdAt: { $gte: start, $lte: end },
        };

        if (regionFilter) matchBase.region = regionFilter;
        
        const raw = await Order.aggregate([
            { $match: matchBase },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productId',
                    unitsSold: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
                    productName: { $first: '$items.name' },
                },
            },
            { $sort: { unitsSold: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDoc',
                },
            },
            {
                $unwind: {
                    path: '$productDoc',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $addFields: {
                    categoryId: { $toObjectId: '$productDoc.category' },
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'categoryId',
                    foreignField: '_id',
                    as: 'categoryDoc',
                },
            },
        ]);

        return raw.map(r => ({
            productId: r._id?.toString() ?? '',
            productName: r.productDoc?.productName ?? r.productName ?? 'Unknown',
            sku: r.productDoc?.sku ?? '-',
            category: r.categoryDoc?.[0]?.name ?? r.productDoc?.category ?? '-',
            unitsSold: r.unitsSold,
            revenue: r.revenue,
        }));
    }

    async getTopCustomers(params: GetTopCustomersParams): Promise<TopCustomerRow[]> {
        const { 
            limit = 10, 
            regionFilter, 
            period,
            customStartDate,
            customEndDate 
        } = params;
        
        const now = new Date();
        const { start, end } = getChartDateRange(period, now, customStartDate, customEndDate);

        const matchBase: any = {
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
            createdAt: { $gte: start, $lte: end },
        };
        
        if (regionFilter) matchBase.region = regionFilter;

        const raw = await Order.aggregate([
            { $match: matchBase },
            {
                $group: {
                    _id: '$userId',
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: '$totalAmount' },
                    lastOrderAt: { $max: '$createdAt' },
                },
            },
            { $sort: { totalSpent: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDoc',
                },
            },
            { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
        ]);

        return raw.map((r, idx) => ({
            userId: r._id?.toString() ?? '',
            customerId: `CST-${r._id?.toString().slice(-6) ?? String(idx).padStart(6, '0')}`,
            name: r.userDoc?.name ?? 'Unknown',
            email: r.userDoc?.email ?? '-',
            phone: r.userDoc?.phoneNumber ?? '-',
            region: r.userDoc?.residentArea ?? '-',
            totalOrders: r.totalOrders,
            totalSpent: r.totalSpent,
            lastOrderAt: r.lastOrderAt ?? null,
        }));
    }

    async getRegionalPerformance(params: GetRegionalPerformanceParams): Promise<RegionalRow[]> {
        const { period, customStartDate, customEndDate } = params;
        const now = new Date();
        const { start, end } = getChartDateRange(period, now, customStartDate, customEndDate);

        const matchBase: any = {
            region: { $exists: true, $ne: null },
            createdAt: { $gte: start, $lte: end },
        };

        const raw = await Order.aggregate([
            { $match: matchBase },
            {
                $group: {
                    _id: '$region',
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                },
            },
            { $sort: { totalRevenue: -1 } },
            {
                $lookup: {
                    from: 'regions',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'regionDoc',
                },
            },
            { $unwind: { path: '$regionDoc', preserveNullAndEmptyArrays: true } },
        ]);

        const totalOrders = raw.reduce((sum, r) => sum + r.totalOrders, 0) || 1;

        return raw.map(r => ({
            regionId: r._id?.toString() ?? '',
            name: r.regionDoc?.name ?? 'Unknown',
            totalOrders: r.totalOrders,
            totalRevenue: r.totalRevenue,
            percent: Math.round((r.totalOrders / totalOrders) * 100),
        }));
    }

    async getRecentOrders(
        limit = 10,
        regionFilter?: mongoose.Types.ObjectId,
    ): Promise<OrderRow[]> {
        const query: any = {};
        if (regionFilter) query.region = regionFilter;

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'name phoneNumber email')
            .populate('shippingAddress', 'address localGovernment state')
            .populate('region', 'name')
            .lean();

        return orders.map(o => ({
            orderId: (o as any)._id.toString(),
            orderNumber: o.orderNumber,
            customerName: (o.userId as any)?.name ?? 'Unknown',
            customerPhone: (o.userId as any)?.phoneNumber ?? '',
            region: (o.region as any)?.name ?? '-',
            status: o.orderStatus,
            amount: o.totalAmount,
            deliveryMethod: o.deliveryMethod,
            createdAt: o.createdAt,
        }));
    }

    async getOverview(
        regionFilter?: mongoose.Types.ObjectId,
        period: Period = "MTD",
        customStartDate?: Date,
        customEndDate?: Date,
    ): Promise<DashboardOverview> {
        const now = new Date();
        const { current, previous } = getPeriodRange(period, now, customStartDate, customEndDate);

        const [
            totalSales,
            completedOrders,
            activeCustomers,
            activeDrivers,
            revenueChart,
            recentOrders,
            topProducts,
            topCustomers,
            regionalPerformance,
        ] = await Promise.all([
            this.buildSalesStatCard(current, previous, regionFilter),
            this.buildOrdersStatCard(current, previous, regionFilter),
            this.buildCustomersStatCard(current, previous, regionFilter),
            this.buildDriversStatCard(),
            this.getRevenueChart({ regionFilter, period, customStartDate, customEndDate }),
            this.getRecentOrders(10, regionFilter),
            this.getTopProducts({ limit: 10, regionFilter, period, customStartDate, customEndDate }),
            this.getTopCustomers({ limit: 10, regionFilter, period, customStartDate, customEndDate }),
            this.getRegionalPerformance({ period, customStartDate, customEndDate }),
        ]);

        return {
            stats: { totalSales, completedOrders, activeCustomers, activeDrivers },
            revenueChart,
            recentOrders,
            topProducts,
            topCustomers,
            regionalPerformance,
        };
    }
}

export default new DashboardOverviewService();