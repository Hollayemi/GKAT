import { Router } from 'express';
import {
    getDashboardOverview,
    getDashboardStats,
    getRevenueChart,
    getRecentOrders,
    getTopProducts,
    getTopCustomers,
    getRegionalPerformance,
} from '../controllers/admin/dashboardOverviewController';
import { protect, checkPermission } from '../middleware/auth';

const router = Router();

// All dashboard routes require authentication + report access permission
router.use(protect);
router.use(checkPermission('access_reports'));

/**
 * Full overview – used on initial page load.
 * Returns stats + chart + all three tables in one request.
 */
router.get('/overview', getDashboardOverview);

/**
 * Granular endpoints – useful for lazy-loading / refreshing
 * individual dashboard sections without re-fetching everything.
 */
router.get('/stats', getDashboardStats);
router.get('/revenue-chart', getRevenueChart);
router.get('/recent-orders', getRecentOrders);
router.get('/top-products', getTopProducts);
router.get('/top-customers', getTopCustomers);
router.get('/regional-performance', getRegionalPerformance);

export default router;
