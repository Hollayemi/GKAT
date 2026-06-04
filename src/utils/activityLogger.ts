/**
 * activityLogger.ts
 *
 * Thin wrapper around ActivityLog.log() that:
 *  - Extracts actor identity, IP, user-agent, method, and endpoint from
 *    the Express Request automatically, so callers never repeat that boilerplate.
 *  - Computes a `changes` array by diffing two plain objects (before/after).
 *  - Always fires fire-and-forget – it NEVER throws, so a logging failure
 *    cannot break a request.
 *
 * Usage:
 *   import { logActivity } from '../../utils/activityLogger';
 *   await logActivity(req, { action: ACTIONS.PRODUCT_CREATED, ... });
 */

import { Request } from 'express';
import ActivityLog, { ActionType, LogParams, SeverityLevel } from '../models/admin/Activitylog.model';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ActivityPayload {
  /** One of the ACTIONS constants */
  action: ActionType;

  /** Human-readable sentence describing what happened.
   *  Include names/identifiers so the log is readable without DB lookups.
   *  e.g. "Deleted product \"Indomie Noodles\" (SKU: GK-123456)"
   */
  description: string;

  /** _id, orderNumber, SKU, coupon code, etc. – whatever links back to the resource */
  targetId?: string;

  /** Mongoose model name: "Product", "Order", "Driver", "Staff", etc. */
  targetType?: string;

  /** Display name of the affected resource */
  targetName?: string;

  /** Snapshot of the document BEFORE the operation (for audits / diffs) */
  before?: Record<string, any>;

  /** Snapshot of the document AFTER the operation */
  after?: Record<string, any>;

  /** Override the default severity inferred from the action */
  severity?: SeverityLevel;

  /** Any extra key-value data you want attached */
  metadata?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the list of top-level keys whose values differ between `before`
 * and `after`. Ignores internal Mongoose fields (__v, updatedAt, _id).
 */
const IGNORED_DIFF_KEYS = new Set(['__v', 'updatedAt', '_id', 'createdAt']);

export function diffObjects(
  before: Record<string, any>,
  after: Record<string, any>
): string[] {
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (IGNORED_DIFF_KEYS.has(key)) continue;
    const bVal = JSON.stringify(before[key]);
    const aVal = JSON.stringify(after[key]);
    if (bVal !== aVal) changed.push(key);
  }

  return changed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strip sensitive keys before storing snapshots
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'passwordSetupToken', 'passwordSetupExpiry',
  'refreshToken', 'resetToken', 'twoFactorSecret', 'token',
]);

export function sanitiseSnapshot(obj: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    clean[k] = v;
  }
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core logger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log an admin activity.  Always fire-and-forget – await is optional.
 *
 * @param req     Express Request (actor identity + request context extracted automatically)
 * @param payload What happened (action, description, target, before/after, …)
 */
export async function logActivity(
  req: Request,
  payload: ActivityPayload
): Promise<void> {
  try {
    const actor = req.user as any;
    if (!actor?.id) return; // unauthenticated – nothing to log

    let changes: string[] | undefined;
    if (payload.before && payload.after) {
      const before = sanitiseSnapshot(payload.before);
      const after  = sanitiseSnapshot(payload.after);
      changes = diffObjects(before, after);
    }

    const params: LogParams = {
      actorId:    actor.id,
      actorName:  actor.fullName ?? actor.name ?? 'Unknown',
      actorEmail: actor.email,
      actorRole:  actor.role?.name ?? actor.role ?? undefined,

      action:      payload.action,
      description: payload.description,

      targetId:    payload.targetId,
      targetType:  payload.targetType,
      targetName:  payload.targetName,

      ipAddress:   (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                   ?? req.socket?.remoteAddress
                   ?? req.ip,
      userAgent:   req.headers['user-agent'],
      method:      req.method,
      endpoint:    req.originalUrl,

      before:      payload.before ? sanitiseSnapshot(payload.before) : undefined,
      after:       payload.after  ? sanitiseSnapshot(payload.after)  : undefined,
      changes,

      severity:    payload.severity,
      metadata:    payload.metadata,
    };

    // Fire and forget – don't block the response
    ActivityLog.log(params).catch((err) =>
      console.error('[activityLogger] fire-and-forget error:', err)
    );
  } catch (err) {
    // Absolutely must not throw
    console.error('[activityLogger] unexpected error:', err);
  }
}

/**
 * Convenience: build before/after payloads from Mongoose .lean() documents
 * and call logActivity in one step.
 */
export async function logUpdate(
  req: Request,
  payload: ActivityPayload & {
    before: Record<string, any>;
    after:  Record<string, any>;
  }
): Promise<void> {
  return logActivity(req, payload);
}
