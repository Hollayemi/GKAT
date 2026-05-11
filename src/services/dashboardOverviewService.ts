import mongoose from 'mongoose';
import Order from '../models/Orders';
import User from '../models/User';
import Product from '../models/admin/Product';
import Driver from '../models/Driver';
import Region from '../models/config/region.model';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface StatCard {
    label: string;
    value: string | number;
    rawValue: number;
    change: string;           // e.g. "+12.3"  (no %)
    positive: boolean;
    sparkline: { value: number }[];
}

export interface RevenueChartPoint {
    month: string;            // "Jan 2025"
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
    revenueChart: RevenueChartPoint[];       // last 12 months
    recentOrders: OrderRow[];                // last 10 orders
    topProducts: TopProductRow[];            // top 10 by units sold (last 30 days)
    topCustomers: TopCustomerRow[];          // top 10 by spend (all time)
    regionalPerformance: RegionalRow[];      // all regions sorted by revenue desc
}

export class DashboardOverviewService {

    private async buildSalesStatCard(
        currentStart: Date, currentEnd: Date,
        previousStart: Date, previousEnd: Date,
        regionFilter?: mongoose.Types.ObjectId,
    ): Promise<StatCard> {
        const matchBase: any = { orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] } };
        if (regionFilter) matchBase.region = regionFilter;

        const [currentAgg, previousAgg, sparkRaw] = await Promise.all([
            Order.aggregate([
                { $match: { ...matchBase, createdAt: { $gte: currentStart, $lte: currentEnd } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ]),
            Order.aggregate([
                { $match: { ...matchBase, createdAt: { $gte: previousStart, $lte: previousEnd } } },
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
        currentStart: Date, currentEnd: Date,
        previousStart: Date, previousEnd: Date,
        regionFilter?: mongoose.Types.ObjectId,
    ): Promise<StatCard> {
        const matchBase: any = { orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] } };
        if (regionFilter) matchBase.region = regionFilter;

        const [current, previous, sparkRaw] = await Promise.all([
            Order.countDocuments({ ...matchBase, createdAt: { $gte: currentStart, $lte: currentEnd } }),
            Order.countDocuments({ ...matchBase, createdAt: { $gte: previousStart, $lte: previousEnd } }),
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
        currentStart: Date, currentEnd: Date,
        previousStart: Date, previousEnd: Date,
        regionFilter?: mongoose.Types.ObjectId,
    ): Promise<StatCard> {
        const orderMatch: any = {};
        if (regionFilter) orderMatch.region = regionFilter;

        // "Active" = placed at least one order in the period
        const [currentIds, previousIds, sparkRaw] = await Promise.all([
            Order.distinct('userId', { ...orderMatch, createdAt: { $gte: currentStart, $lte: currentEnd } }),
            Order.distinct('userId', { ...orderMatch, createdAt: { $gte: previousStart, $lte: previousEnd } }),
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

    async getRevenueChart(regionFilter?: mongoose.Types.ObjectId): Promise<RevenueChartPoint[]> {
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

        const matchBase: any = {
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
            createdAt: { $gte: twelveMonthsAgo },
        };
        if (regionFilter) matchBase.region = regionFilter;

        const raw = await Order.aggregate([
            { $match: matchBase },
            {
                $group: {
                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        // Build a full 12-month array (fill zeros for months with no data)
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const result: RevenueChartPoint[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = d.getMonth() + 1; // 1-based
            const found = raw.find(r => r._id.year === year && r._id.month === month);
            result.push({
                month: `${monthLabels[d.getMonth()]} ${year}`,
                revenue: found?.revenue ?? 0,
                orders: found?.orders ?? 0,
            });
        }
        return result;
    }

    // ------------------------------------------------------------------
    // RECENT ORDERS
    // ------------------------------------------------------------------

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

    async getTopProducts(
        limit = 10,
        regionFilter?: mongoose.Types.ObjectId,
    ): Promise<TopProductRow[]> {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const matchBase: any = {
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
            createdAt: { $gte: thirtyDaysAgo },
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

        console.log(raw)

        return raw.map(r => ({
            productId: r._id?.toString() ?? '',
            productName: r.productDoc?.productName ?? r.productName ?? 'Unknown',
            sku: r.productDoc?.sku ?? '-',
            category: r.categoryDoc?.[0]?.name ?? r.productDoc?.category ?? '-',
            unitsSold: r.unitsSold,
            revenue: r.revenue,
        }));
    }

    async getTopCustomers(
        limit = 10,
        regionFilter?: mongoose.Types.ObjectId,
    ): Promise<TopCustomerRow[]> {
        const matchBase: any = {
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
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

    async getRegionalPerformance(): Promise<RegionalRow[]> {
        const raw = await Order.aggregate([
            {
                $match: {
                    orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
                    region: { $exists: true, $ne: null },
                },
            },
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

    async getOverview(regionFilter?: mongoose.Types.ObjectId): Promise<DashboardOverview> {
        const now = new Date();
        const thisMonth = monthBounds(now.getFullYear(), now.getMonth());
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = monthBounds(lastMonthDate.getFullYear(), lastMonthDate.getMonth());

        const currentStart = thisMonth.gte;
        const currentEnd = new Date(); // up to now
        const previousStart = lastMonth.gte;
        const previousEnd = lastMonth.lt;

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
            this.buildSalesStatCard(currentStart, currentEnd, previousStart, previousEnd, regionFilter),
            this.buildOrdersStatCard(currentStart, currentEnd, previousStart, previousEnd, regionFilter),
            this.buildCustomersStatCard(currentStart, currentEnd, previousStart, previousEnd, regionFilter),
            this.buildDriversStatCard(),
            this.getRevenueChart(regionFilter),
            this.getRecentOrders(10, regionFilter),
            this.getTopProducts(10, regionFilter),
            this.getTopCustomers(10, regionFilter),
            this.getRegionalPerformance(),
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