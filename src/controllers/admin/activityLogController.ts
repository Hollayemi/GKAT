/**
 * activityLogController.ts
 *
 * Exposes three endpoints consumed by the admin UI:
 *
 *  GET /api/v1/admin/activity                 – global paginated feed
 *  GET /api/v1/admin/activity/summary         – counts per category (dashboard widget)
 *  GET /api/v1/admin/activity/staff/:staffId  – per-staff logs
 */

import { Request, Response, NextFunction } from 'express';
import ActivityLog, { FeedParams, ACTION_CATEGORIES, SEVERITY_LEVELS } from '../../models/admin/Activitylog.model';
import { asyncHandler, AppResponse, AppError } from '../../middleware/error';

// ─────────────────────────────────────────────────────────────────────────────
// Global activity feed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/activity
 *
 * Query params:
 *   page        – default 1
 *   limit       – default 20, max 100
 *   category    – auth | staff | order | product | customer | driver | coupon |
 *                 category | region | advert | role | subscription | system
 *   severity    – low | medium | high | critical
 *   actorId     – filter by a specific staff member's ObjectId
 *   targetType  – "Product" | "Order" | "Driver" | "Staff" | …
 *   targetId    – filter by a specific resource id / orderNumber
 *   startDate   – ISO date string
 *   endDate     – ISO date string
 *   search      – full-text search across actorName, description, targetName, label
 */
export const getActivityFeed = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1, limit = 20,
    category, severity,
    actorId, targetType, targetId,
    startDate, endDate,
    search,
  } = req.query;

  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const params: FeedParams = {
    page:       parseInt(page as string) || 1,
    limit:      limitNum,
    category:   category   as any,
    severity:   severity   as any,
    actorId:    actorId    as string | undefined,
    targetType: targetType as string | undefined,
    targetId:   targetId   as string | undefined,
    startDate:  startDate  ? new Date(startDate  as string) : undefined,
    endDate:    endDate    ? new Date(endDate    as string) : undefined,
    search:     search     as string | undefined,
  };

  const { logs, total, pages } = await ActivityLog.getFeed(params);

  (res as AppResponse).data(
    {
      logs,
      pagination: {
        page:  params.page,
        limit: params.limit,
        total,
        pages,
      },
      // Expose filter options to help the UI build dropdown menus
      filterOptions: {
        categories: Object.values(ACTION_CATEGORIES),
        severities:  Object.values(SEVERITY_LEVELS),
      },
    },
    'Activity feed retrieved successfully'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-staff activity log
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/activity/staff/:staffId
 *
 * Accepts the same query params as the global feed (minus actorId).
 */
export const getStaffActivityLog = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { staffId } = req.params;

  if (!staffId) return next(new AppError('staffId is required', 400));

  const {
    page = 1, limit = 20,
    category, severity,
    startDate, endDate,
    search,
  } = req.query;

  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const params: FeedParams = {
    page:      parseInt(page as string) || 1,
    limit:     limitNum,
    category:  category  as any,
    severity:  severity  as any,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate:   endDate   ? new Date(endDate   as string) : undefined,
    search:    search    as string | undefined,
  };

  const { logs, total } = await ActivityLog.getStaffLogs(staffId, params);

  (res as AppResponse).data(
    {
      logs,
      pagination: {
        page:  params.page,
        limit: params.limit,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
    'Staff activity log retrieved successfully'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard summary widget
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/activity/summary?hours=24
 *
 * Returns activity counts grouped by category for the last N hours.
 * Designed as a lightweight "Recent Activity" dashboard card.
 */
export const getActivitySummary = asyncHandler(async (req: Request, res: Response) => {
  const hours = Math.min(parseInt((req.query.hours as string) || '24'), 720); // cap at 30 days

  const summary = await ActivityLog.getSummary(hours);

  const totalActions   = summary.reduce((s, r) => s + r.total,    0);
  const criticalCount  = summary.reduce((s, r) => s + r.critical,  0);
  const highCount      = summary.reduce((s, r) => s + r.high,      0);

  (res as AppResponse).data(
    {
      period:  `Last ${hours} hour(s)`,
      totals:  { actions: totalActions, critical: criticalCount, high: highCount },
      byCategory: summary,
    },
    'Activity summary retrieved successfully'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Single log entry detail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/activity/:logId
 *
 * Returns the full log entry including before/after diff – useful when an
 * admin clicks a feed item to see the full audit detail.
 */
export const getActivityLogDetail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const log = await ActivityLog.findById(req.params.logId).lean();
  if (!log) return next(new AppError('Log entry not found', 404));

  const instance  = new ActivityLog(log);
  const feedItem  = instance.toFeedItem();

  (res as AppResponse).data(
    {
      ...feedItem,
      // Include raw diff data not exposed on the standard feed item
      before:  (log as any).before,
      after:   (log as any).after,
      changes: (log as any).changes,
      userAgent: (log as any).userAgent,
      method:    (log as any).method,
    },
    'Activity log detail retrieved successfully'
  );
});
