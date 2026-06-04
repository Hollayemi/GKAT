import mongoose, { Document, Schema, Types, Model } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Constants – single source of truth for action categories & severities
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_CATEGORIES = {
  AUTH: 'auth',
  STAFF: 'staff',
  ORDER: 'order',
  PRODUCT: 'product',
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  COUPON: 'coupon',
  CATEGORY: 'category',
  REGION: 'region',
  ADVERT: 'advert',
  ROLE: 'role',
  SUBSCRIPTION: 'subscription',
  SYSTEM: 'system',
} as const;

export type ActionCategory = (typeof ACTION_CATEGORIES)[keyof typeof ACTION_CATEGORIES];

export const SEVERITY_LEVELS = {
  LOW: 'low',       // read / view operations
  MEDIUM: 'medium', // creates / updates
  HIGH: 'high',     // deletes / bulk ops
  CRITICAL: 'critical', // auth failures, password resets, account disables
} as const;

export type SeverityLevel = (typeof SEVERITY_LEVELS)[keyof typeof SEVERITY_LEVELS];

// Predefined action types for consistency across the codebase
export const ACTIONS = {
  // Auth
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_CHANGED: 'password_changed',

  // Staff
  STAFF_CREATED: 'staff_created',
  STAFF_UPDATED: 'staff_updated',
  STAFF_DELETED: 'staff_deleted',
  STAFF_SUSPENDED: 'staff_suspended',
  STAFF_UNSUSPENDED: 'staff_unsuspended',
  STAFF_DISABLED: 'staff_disabled',
  STAFF_ENABLED: 'staff_enabled',
  STAFF_BULK_SUSPENDED: 'staff_bulk_suspended',
  STAFF_BULK_DELETED: 'staff_bulk_deleted',
  STAFF_ROLE_UPDATED: 'staff_role_updated',

  // Orders
  ORDER_VIEWED: 'order_viewed',
  ORDER_STATUS_UPDATED: 'order_status_updated',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_TRANSFERRED: 'order_transferred',
  DRIVER_ASSIGNED: 'driver_assigned',

  // Products
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
  PRODUCT_DELETED: 'product_deleted',
  PRODUCT_BULK_UPDATED: 'product_bulk_updated',
  PRODUCT_STOCK_UPDATED: 'product_stock_updated',
  PRODUCT_VARIANT_ADDED: 'product_variant_added',
  PRODUCT_VARIANT_UPDATED: 'product_variant_updated',
  PRODUCT_VARIANT_DELETED: 'product_variant_deleted',
  PRODUCT_DEAL_SET: 'product_deal_set',
  PRODUCT_DEAL_REMOVED: 'product_deal_removed',
  PRODUCTS_IMPORTED: 'products_imported',
  PRODUCTS_EXPORTED: 'products_exported',

  // Customers
  CUSTOMER_VIEWED: 'customer_viewed',
  CUSTOMERS_EXPORTED: 'customers_exported',

  // Drivers
  DRIVER_CREATED: 'driver_created',
  DRIVER_UPDATED: 'driver_updated',
  DRIVER_DELETED: 'driver_deleted',
  DRIVER_VERIFIED: 'driver_verified',
  DRIVER_REJECTED: 'driver_rejected',
  DRIVER_SUSPENDED: 'driver_suspended',
  DRIVER_UNSUSPENDED: 'driver_unsuspended',
  DRIVER_DISABLED: 'driver_disabled',
  DRIVER_ENABLED: 'driver_enabled',
  DRIVER_BULK_SUSPENDED: 'driver_bulk_suspended',
  DRIVER_BULK_DELETED: 'driver_bulk_deleted',

  // Coupons
  COUPON_CREATED: 'coupon_created',
  COUPON_UPDATED: 'coupon_updated',
  COUPON_DELETED: 'coupon_deleted',
  COUPON_STATUS_TOGGLED: 'coupon_status_toggled',
  COUPON_BULK_UPDATED: 'coupon_bulk_updated',

  // Categories
  CATEGORY_CREATED: 'category_created',
  CATEGORY_UPDATED: 'category_updated',
  CATEGORY_DELETED: 'category_deleted',
  CATEGORY_TOGGLED: 'category_toggled',
  CATEGORIES_REORDERED: 'categories_reordered',

  // Regions
  REGION_CREATED: 'region_created',
  REGION_UPDATED: 'region_updated',
  REGION_DELETED: 'region_deleted',
  REGION_TOGGLED: 'region_toggled',

  // Adverts
  ADVERT_CREATED: 'advert_created',
  ADVERT_UPDATED: 'advert_updated',
  ADVERT_DELETED: 'advert_deleted',
  ADVERT_TOGGLED: 'advert_toggled',
  ADVERTS_REORDERED: 'adverts_reordered',

  // Roles
  ROLE_CREATED: 'role_created',
  ROLE_UPDATED: 'role_updated',
  ROLE_DELETED: 'role_deleted',
  PERMISSION_ADDED: 'permission_added',
  PERMISSION_REMOVED: 'permission_removed',

  // Subscriptions
  SUBSCRIPTION_PLAN_CREATED: 'subscription_plan_created',
  SUBSCRIPTION_PLAN_UPDATED: 'subscription_plan_updated',
  SUBSCRIPTION_PLAN_DELETED: 'subscription_plan_deleted',
  SUBSCRIPTION_PLAN_TOGGLED: 'subscription_plan_toggled',
} as const;

export type ActionType = (typeof ACTIONS)[keyof typeof ACTIONS];

// Map every action to its category and default severity
const ACTION_META: Record<
  ActionType,
  { category: ActionCategory; severity: SeverityLevel; label: string }
> = {
  // Auth
  login:                      { category: 'auth',         severity: 'low',      label: 'Logged in' },
  logout:                     { category: 'auth',         severity: 'low',      label: 'Logged out' },
  login_failed:               { category: 'auth',         severity: 'critical', label: 'Login failed' },
  password_reset:             { category: 'auth',         severity: 'critical', label: 'Password reset' },
  password_changed:           { category: 'auth',         severity: 'high',     label: 'Password changed' },
  // Staff
  staff_created:              { category: 'staff',        severity: 'medium',   label: 'Staff created' },
  staff_updated:              { category: 'staff',        severity: 'medium',   label: 'Staff updated' },
  staff_deleted:              { category: 'staff',        severity: 'high',     label: 'Staff deleted' },
  staff_suspended:            { category: 'staff',        severity: 'high',     label: 'Staff suspended' },
  staff_unsuspended:          { category: 'staff',        severity: 'medium',   label: 'Staff unsuspended' },
  staff_disabled:             { category: 'staff',        severity: 'critical', label: 'Staff disabled' },
  staff_enabled:              { category: 'staff',        severity: 'medium',   label: 'Staff enabled' },
  staff_bulk_suspended:       { category: 'staff',        severity: 'high',     label: 'Staff bulk suspended' },
  staff_bulk_deleted:         { category: 'staff',        severity: 'critical', label: 'Staff bulk deleted' },
  staff_role_updated:         { category: 'staff',        severity: 'high',     label: 'Staff role updated' },
  // Orders
  order_viewed:               { category: 'order',        severity: 'low',      label: 'Order viewed' },
  order_status_updated:       { category: 'order',        severity: 'medium',   label: 'Order status updated' },
  order_cancelled:            { category: 'order',        severity: 'high',     label: 'Order cancelled' },
  order_transferred:          { category: 'order',        severity: 'medium',   label: 'Order transferred' },
  driver_assigned:            { category: 'order',        severity: 'medium',   label: 'Driver assigned to order' },
  // Products
  product_created:            { category: 'product',      severity: 'medium',   label: 'Product created' },
  product_updated:            { category: 'product',      severity: 'medium',   label: 'Product updated' },
  product_deleted:            { category: 'product',      severity: 'high',     label: 'Product deleted' },
  product_bulk_updated:       { category: 'product',      severity: 'high',     label: 'Products bulk updated' },
  product_stock_updated:      { category: 'product',      severity: 'medium',   label: 'Product stock updated' },
  product_variant_added:      { category: 'product',      severity: 'medium',   label: 'Product variant added' },
  product_variant_updated:    { category: 'product',      severity: 'medium',   label: 'Product variant updated' },
  product_variant_deleted:    { category: 'product',      severity: 'high',     label: 'Product variant deleted' },
  product_deal_set:           { category: 'product',      severity: 'medium',   label: 'Deal of day set' },
  product_deal_removed:       { category: 'product',      severity: 'medium',   label: 'Deal removed' },
  products_imported:          { category: 'product',      severity: 'high',     label: 'Products imported via CSV' },
  products_exported:          { category: 'product',      severity: 'low',      label: 'Products exported to CSV' },
  // Customers
  customer_viewed:            { category: 'customer',     severity: 'low',      label: 'Customer profile viewed' },
  customers_exported:         { category: 'customer',     severity: 'medium',   label: 'Customers exported' },
  // Drivers
  driver_created:             { category: 'driver',       severity: 'medium',   label: 'Driver registered' },
  driver_updated:             { category: 'driver',       severity: 'medium',   label: 'Driver updated' },
  driver_deleted:             { category: 'driver',       severity: 'high',     label: 'Driver deleted' },
  driver_verified:            { category: 'driver',       severity: 'medium',   label: 'Driver verified' },
  driver_rejected:            { category: 'driver',       severity: 'high',     label: 'Driver rejected' },
  driver_suspended:           { category: 'driver',       severity: 'high',     label: 'Driver suspended' },
  driver_unsuspended:         { category: 'driver',       severity: 'medium',   label: 'Driver unsuspended' },
  driver_disabled:            { category: 'driver',       severity: 'critical', label: 'Driver disabled' },
  driver_enabled:             { category: 'driver',       severity: 'medium',   label: 'Driver enabled' },
  driver_bulk_suspended:      { category: 'driver',       severity: 'high',     label: 'Drivers bulk suspended' },
  driver_bulk_deleted:        { category: 'driver',       severity: 'critical', label: 'Drivers bulk deleted' },
  // Coupons
  coupon_created:             { category: 'coupon',       severity: 'medium',   label: 'Coupon created' },
  coupon_updated:             { category: 'coupon',       severity: 'medium',   label: 'Coupon updated' },
  coupon_deleted:             { category: 'coupon',       severity: 'high',     label: 'Coupon deleted' },
  coupon_status_toggled:      { category: 'coupon',       severity: 'medium',   label: 'Coupon status toggled' },
  coupon_bulk_updated:        { category: 'coupon',       severity: 'high',     label: 'Coupons bulk updated' },
  // Categories
  category_created:           { category: 'category',     severity: 'medium',   label: 'Category created' },
  category_updated:           { category: 'category',     severity: 'medium',   label: 'Category updated' },
  category_deleted:           { category: 'category',     severity: 'high',     label: 'Category deleted' },
  category_toggled:           { category: 'category',     severity: 'medium',   label: 'Category toggled' },
  categories_reordered:       { category: 'category',     severity: 'low',      label: 'Categories reordered' },
  // Regions
  region_created:             { category: 'region',       severity: 'medium',   label: 'Region created' },
  region_updated:             { category: 'region',       severity: 'medium',   label: 'Region updated' },
  region_deleted:             { category: 'region',       severity: 'high',     label: 'Region deleted' },
  region_toggled:             { category: 'region',       severity: 'medium',   label: 'Region toggled' },
  // Adverts
  advert_created:             { category: 'advert',       severity: 'medium',   label: 'Advert created' },
  advert_updated:             { category: 'advert',       severity: 'medium',   label: 'Advert updated' },
  advert_deleted:             { category: 'advert',       severity: 'high',     label: 'Advert deleted' },
  advert_toggled:             { category: 'advert',       severity: 'medium',   label: 'Advert toggled' },
  adverts_reordered:          { category: 'advert',       severity: 'low',      label: 'Adverts reordered' },
  // Roles
  role_created:               { category: 'role',         severity: 'high',     label: 'Role created' },
  role_updated:               { category: 'role',         severity: 'high',     label: 'Role updated' },
  role_deleted:               { category: 'role',         severity: 'critical', label: 'Role deleted' },
  permission_added:           { category: 'role',         severity: 'high',     label: 'Permission added to role' },
  permission_removed:         { category: 'role',         severity: 'high',     label: 'Permission removed from role' },
  // Subscriptions
  subscription_plan_created:  { category: 'subscription', severity: 'medium',   label: 'Subscription plan created' },
  subscription_plan_updated:  { category: 'subscription', severity: 'medium',   label: 'Subscription plan updated' },
  subscription_plan_deleted:  { category: 'subscription', severity: 'high',     label: 'Subscription plan deleted' },
  subscription_plan_toggled:  { category: 'subscription', severity: 'medium',   label: 'Subscription plan toggled' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface IActivityLog extends Document {
  // Who performed the action
  actorId: Types.ObjectId;
  actorName: string;
  actorEmail?: string;
  actorRole?: string;

  // What was done
  action: ActionType;
  category: ActionCategory;
  severity: SeverityLevel;
  label: string;           // human-readable short label, e.g. "Product deleted"
  description: string;     // longer context sentence

  // What was affected (optional refs for deep-linking)
  targetId?: string;       // e.g. product _id, order number, staff _id
  targetType?: string;     // e.g. "Product", "Order", "Staff"
  targetName?: string;     // e.g. product name, order number

  // Request context
  ipAddress?: string;
  userAgent?: string;
  method?: string;         // HTTP method
  endpoint?: string;       // e.g. "/api/v1/admin/products"

  // Diff / before-after snapshot (great for audits)
  before?: Record<string, any>;
  after?: Record<string, any>;
  changes?: string[];      // list of field names that changed

  // Extra flexible payload
  metadata?: Record<string, any>;

  timestamp: Date;

  // virtuals / instance methods
  isCritical: boolean;
  toFeedItem(): ActivityFeedItem;
}

// Shape returned to UI consumers
export interface ActivityFeedItem {
  id: string;
  timestamp: Date;
  relativeTime: string;
  actor: { id: string; name: string; email?: string; role?: string };
  action: string;
  label: string;
  description: string;
  category: ActionCategory;
  severity: SeverityLevel;
  severityColor: string;   // 'green' | 'yellow' | 'orange' | 'red'
  categoryIcon: string;    // emoji / icon key for UI
  target?: { id?: string; type?: string; name?: string };
  changes?: string[];
  ipAddress?: string;
  endpoint?: string;
  metadata?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static method typings
// ─────────────────────────────────────────────────────────────────────────────

export interface IActivityLogModel extends Model<IActivityLog> {
  /**
   * Primary logging method – infers category, severity, and label from the
   * action type automatically. Silently swallows errors so a logging failure
   * never breaks the request.
   */
  log(params: LogParams): Promise<IActivityLog | null>;

  /**
   * Retrieve a paginated, filterable activity feed for the UI.
   */
  getFeed(params: FeedParams): Promise<{ logs: ActivityFeedItem[]; total: number; pages: number }>;

  /**
   * Logs for a specific staff member.
   */
  getStaffLogs(staffId: string, params?: FeedParams): Promise<{ logs: ActivityFeedItem[]; total: number }>;

  /**
   * Recent activity summary grouped by category (dashboard widget).
   */
  getSummary(hours?: number, regionId?: string): Promise<ActivitySummary[]>;
}

export interface LogParams {
  actorId: string;
  actorName: string;
  actorEmail?: string;
  actorRole?: string;
  action: ActionType;
  description: string;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  endpoint?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  changes?: string[];
  metadata?: Record<string, any>;
  // Override auto-inferred severity when needed
  severity?: SeverityLevel;
}

export interface FeedParams {
  page?: number;
  limit?: number;
  category?: ActionCategory;
  severity?: SeverityLevel;
  actorId?: string;
  targetId?: string;
  targetType?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface ActivitySummary {
  category: ActionCategory;
  icon: string;
  total: number;
  critical: number;
  high: number;
  recentActions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  low: 'green',
  medium: 'yellow',
  high: 'orange',
  critical: 'red',
};

const CATEGORY_ICONS: Record<ActionCategory, string> = {
  auth: 'lock',
  staff: 'users',
  order: 'shopping-cart',
  product: 'package',
  customer: 'user',
  driver: 'truck',
  coupon: 'tag',
  category: 'grid',
  region: 'map-pin',
  advert: 'image',
  role: 'shield',
  subscription: 'credit-card',
  system: 'settings',
};

function getRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const ActivityLogSchema = new Schema<IActivityLog, IActivityLogModel>(
  {
    actorId:     { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    actorName:   { type: String, required: true },
    actorEmail:  { type: String },
    actorRole:   { type: String },

    action:      { type: String, required: true, index: true },
    category:    { type: String, required: true, index: true },
    severity:    { type: String, enum: Object.values(SEVERITY_LEVELS), required: true, index: true },
    label:       { type: String, required: true },
    description: { type: String, required: true },

    targetId:    { type: String, index: true },
    targetType:  { type: String, index: true },
    targetName:  { type: String },

    ipAddress:   { type: String },
    userAgent:   { type: String },
    method:      { type: String },
    endpoint:    { type: String },

    before:      { type: Schema.Types.Mixed },
    after:       { type: Schema.Types.Mixed },
    changes:     [{ type: String }],

    metadata:    { type: Schema.Types.Mixed },

    timestamp:   { type: Date, default: Date.now, index: true },
  },
  { timestamps: false, versionKey: false }
);

// Compound indexes for the most common UI queries
ActivityLogSchema.index({ actorId: 1, timestamp: -1 });
ActivityLogSchema.index({ category: 1, timestamp: -1 });
ActivityLogSchema.index({ severity: 1, timestamp: -1 });
ActivityLogSchema.index({ targetId: 1, targetType: 1, timestamp: -1 });
ActivityLogSchema.index({ timestamp: -1 });

// TTL: auto-delete logs older than 1 year (adjust as needed)
ActivityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// ─────────────────────────────────────────────────────────────────────────────
// Virtual
// ─────────────────────────────────────────────────────────────────────────────

ActivityLogSchema.virtual('isCritical').get(function (this: IActivityLog) {
  return this.severity === SEVERITY_LEVELS.CRITICAL;
});

// ─────────────────────────────────────────────────────────────────────────────
// Instance methods
// ─────────────────────────────────────────────────────────────────────────────

ActivityLogSchema.methods.toFeedItem = function (this: IActivityLog): ActivityFeedItem {
  return {
    id: (this._id as Types.ObjectId).toString(),
    timestamp: this.timestamp,
    relativeTime: getRelativeTime(this.timestamp),
    actor: {
      id: this.actorId.toString(),
      name: this.actorName,
      email: this.actorEmail,
      role: this.actorRole,
    },
    action: this.action,
    label: this.label,
    description: this.description,
    category: this.category,
    severity: this.severity,
    severityColor: SEVERITY_COLORS[this.severity],
    categoryIcon: CATEGORY_ICONS[this.category],
    target: this.targetId
      ? { id: this.targetId, type: this.targetType, name: this.targetName }
      : undefined,
    changes: this.changes?.length ? this.changes : undefined,
    ipAddress: this.ipAddress,
    endpoint: this.endpoint,
    metadata: this.metadata,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Static methods
// ─────────────────────────────────────────────────────────────────────────────

ActivityLogSchema.statics.log = async function (
  this: IActivityLogModel,
  params: LogParams
): Promise<IActivityLog | null> {
  try {
    const meta = ACTION_META[params.action];
    if (!meta) {
      console.warn(`[ActivityLog] Unknown action: ${params.action}`);
      return null;
    }

    const doc = await this.create({
      actorId:     params.actorId,
      actorName:   params.actorName,
      actorEmail:  params.actorEmail,
      actorRole:   params.actorRole,
      action:      params.action,
      category:    meta.category,
      severity:    params.severity ?? meta.severity,
      label:       meta.label,
      description: params.description,
      targetId:    params.targetId,
      targetType:  params.targetType,
      targetName:  params.targetName,
      ipAddress:   params.ipAddress,
      userAgent:   params.userAgent,
      method:      params.method,
      endpoint:    params.endpoint,
      before:      params.before,
      after:       params.after,
      changes:     params.changes,
      metadata:    params.metadata,
      timestamp:   new Date(),
    });

    return doc;
  } catch (err) {
    // Never let a logging failure bubble up into the request
    console.error('[ActivityLog] Failed to write log:', err);
    return null;
  }
};

ActivityLogSchema.statics.getFeed = async function (
  this: IActivityLogModel,
  params: FeedParams = {}
): Promise<{ logs: ActivityFeedItem[]; total: number; pages: number }> {
  const {
    page = 1,
    limit = 20,
    category,
    severity,
    actorId,
    targetId,
    targetType,
    startDate,
    endDate,
    search,
  } = params;

  const query: Record<string, any> = {};

  if (category)   query.category  = category;
  if (severity)   query.severity  = severity;
  if (actorId)    query.actorId   = new mongoose.Types.ObjectId(actorId);
  if (targetId)   query.targetId  = targetId;
  if (targetType) query.targetType = targetType;

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate)   query.timestamp.$lte = endDate;
  }

  if (search) {
    const re = { $regex: search, $options: 'i' };
    query.$or = [
      { actorName:   re },
      { description: re },
      { targetName:  re },
      { label:       re },
    ];
  }

  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    this.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean<IActivityLog[]>(),
    this.countDocuments(query),
  ]);

  // lean() returns plain objects so we call the instance method logic directly
  const logs = docs.map((doc) => {
    const instance = new this(doc);
    return instance.toFeedItem();
  });

  return { logs, total, pages: Math.ceil(total / limit) };
};

ActivityLogSchema.statics.getStaffLogs = async function (
  this: IActivityLogModel,
  staffId: string,
  params: FeedParams = {}
): Promise<{ logs: ActivityFeedItem[]; total: number }> {
  const result = await (this as any).getFeed({ ...params, actorId: staffId });
  return { logs: result.logs, total: result.total };
};

ActivityLogSchema.statics.getSummary = async function (
  this: IActivityLogModel,
  hours = 24,
  _regionId?: string
): Promise<ActivitySummary[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const rows = await this.aggregate([
    { $match: { timestamp: { $gte: since } } },
    {
      $group: {
        _id: '$category',
        total:    { $sum: 1 },
        critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        high:     { $sum: { $cond: [{ $eq: ['$severity', 'high'] },     1, 0] } },
        recentActions: { $push: '$label' },
      },
    },
    { $sort: { total: -1 } },
  ]);

  return rows.map((r) => ({
    category: r._id as ActionCategory,
    icon: CATEGORY_ICONS[r._id as ActionCategory] ?? 'activity',
    total: r.total,
    critical: r.critical,
    high: r.high,
    // return up to 5 unique recent action labels
    recentActions: [...new Set<string>(r.recentActions)].slice(0, 5),
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// Model export
// ─────────────────────────────────────────────────────────────────────────────

export default mongoose.model<IActivityLog, IActivityLogModel>('ActivityLog', ActivityLogSchema);
