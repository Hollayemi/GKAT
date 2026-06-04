import { Router } from 'express';
import {
  getActivityFeed,
  getStaffActivityLog,
  getActivitySummary,
  getActivityLogDetail,
} from '../../controllers/admin/activityLogController';
import { protect, authorize } from '../../middleware/auth';

const router = Router();
router.use(protect);
router.use(authorize('admin'));




/**
 * Global feed – filterable by category, severity, actor, target, date, search
 * GET /api/v1/admin/activity
 */
router.get('/', getActivityFeed);

/**
 * Lightweight summary for the dashboard widget
 * GET /api/v1/admin/activity/summary?hours=24
 */
router.get('/summary', getActivitySummary);

/**
 * Per-staff activity log
 * GET /api/v1/admin/activity/staff/:staffId
 */
router.get('/staff/:staffId', getStaffActivityLog);

/**
 * Full detail of a single log entry (includes before/after diff)
 * GET /api/v1/admin/activity/:logId
 */
router.get('/:logId', getActivityLogDetail);

export default router;
