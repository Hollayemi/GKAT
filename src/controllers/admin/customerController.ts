import { Request, Response, NextFunction } from "express";
import User from "../../models/User";
import Order from "../../models/Orders";
import { asyncHandler, AppResponse, AppError } from "../../middleware/error";

function formatDate(date?: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name?: string | null): string {
  if (!name || name.trim() === "") return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Deterministic color from userId — stable across re-renders */
function getAvatarColor(userId: string): string {
  const colors = [
    "bg-pink-200",
    "bg-orange-200",
    "bg-blue-200",
    "bg-yellow-200",
    "bg-purple-200",
    "bg-cyan-200",
    "bg-green-200",
    "bg-gray-200",
  ];
  const index = parseInt(userId.slice(-1), 16) % colors.length;
  return colors[index];
}

function capitaliseStatus(status: string): string {
  const map: Record<string, string> = {
    pending: "Pending",
    confirmed: "Pending",
    processing: "Processing",
    shipped: "En-Route",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Cancelled",
    refunded: "Cancelled",
  };
  return map[status] ?? status;
}

function getBadges(totalOrders: number): string[] {
  if (totalOrders > 10) return ["Frequent Buyer"];
  if (totalOrders <= 2 && totalOrders > 0) return ["New User"];
  return [];
}

function formatCustomer(user: any, userOrders: any[]) {
  const totalOrders = userOrders.length;
  const totalSpent = userOrders.reduce(
    (sum, o) => sum + (o.totalAmount ?? 0),
    0,
  );

  const sortedOrders = [...userOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const lastOrder = sortedOrders[0];
  const userId = user._id.toString();

  return {
    id: userId,
    customerId: `CST-${userId.slice(-6)}`,
    name: user.name ?? "Unknown",
    email: user.email ?? "-",
    phone: user.phoneNumber ?? user.phone ?? "",
    region: user.defaultAddress ?? "Unknown",
    address: Array.isArray(user.addresses)
      ? (user.addresses[0]?.address ?? "")
      : (user.addresses ?? ""),
    totalOrders,
    totalSpent,
    dateJoined: formatDate(user.createdAt),
    lastActivity: formatDate(lastOrder?.createdAt),
    status: totalOrders === 0 ? "In-active" : "Active",
    badges: getBadges(totalOrders),
    avatar: getInitials(user.name),
    avatarColor: getAvatarColor(userId),
    purchaseHistory: [],
    customerActivity: [],
    loyaltyProgress: [],
    stats: {
      totalOrders,
      totalSpent,
      averageOrderValue: totalOrders ? Math.round(totalSpent / totalOrders) : 0,
      lastOrderDate: formatDate(lastOrder?.createdAt),
      cancelledOrders: userOrders.filter((o) => o.orderStatus === "cancelled")
        .length,
    },
  };
}

function buildUserQuery(params: {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Record<string, any> {
  const query: any = {};

  if (params.search) {
    query.$or = [
      { name: new RegExp(params.search, "i") },
      { email: new RegExp(params.search, "i") },
    ];
  }

  // Date range filters on createdAt (when the user joined)
  if (params.dateFrom || params.dateTo) {
    query.createdAt = {};
    if (params.dateFrom) {
      query.createdAt.$gte = new Date(params.dateFrom);
    }
    if (params.dateTo) {
      // Include the full dateTo day
      const to = new Date(params.dateTo);
      to.setHours(23, 59, 59, 999);
      query.createdAt.$lte = to;
    }
  }

  return query;
}

/**
 * GET /api/v1/admin/customers
 * Query params: page, limit, search, status, badge, dateFrom, dateTo
 */
export const getAllCustomers = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 8,
      search = "",
      status = "all",
      badge = "all",
      dateFrom,
      dateTo,
    } = req.query;

    const query = buildUserQuery({
      search: search as string,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query),
    ]);

    const userIds = users.map((u) => u._id);

    const groupedOrders = await Order.aggregate([
      { $match: { userId: { $in: userIds } } },
      {
        $group: {
          _id: "$userId",
          orders: { $push: "$$ROOT" },
        },
      },
    ]);

    const ordersByUser: Record<string, any[]> = {};

    for (const group of groupedOrders) {
      ordersByUser[group._id.toString()] = group.orders;
    }

    let customers = users.map((user) =>
      formatCustomer(user, ordersByUser[user._id.toString()] ?? []),
    );

    // Status filter
    if (status === "active") {
      customers = customers.filter((c) => c.status === "Active");
    } else if (status === "inactive") {
      customers = customers.filter((c) => c.status === "In-active");
    }

    // Badge filter
    if (badge === "frequent_buyer") {
      customers = customers.filter((c) => c.badges.includes("Frequent Buyer"));
    } else if (badge === "new_user") {
      customers = customers.filter((c) => c.badges.includes("New User"));
    }

    // ── Stats (always on full collection) ────────────────────────────────────
    const [allUsers, allOrd] = await Promise.all([
      User.find().lean(),
      Order.find().lean(),
    ]);

    const totalCustomers = allUsers.length;
    const activeCustomers = allUsers.filter((u) =>
      allOrd.some((o) => o.userId.toString() === u._id.toString()),
    ).length;
    const inactiveCustomers = totalCustomers - activeCustomers;
    const totalRevenue = allOrd.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );
    const avgOrderValue = allOrd.length
      ? Math.round(totalRevenue / allOrd.length)
      : 0;
    const refunds = allOrd.filter((o) => o.orderStatus === "refunded").length;

    const stats = [
      {
        label: "Total Customers",
        value: String(totalCustomers),
        color: "purple",
      },
      {
        label: "Active Customers",
        value: String(activeCustomers),
        color: "orange",
      },
      {
        label: "Inactive Customers",
        value: String(inactiveCustomers),
        color: "cyan",
      },
      {
        label: "Avg. Order Value",
        value: `₦${avgOrderValue.toLocaleString()}`,
        color: "red",
      },
      { label: "Refunds", value: String(refunds), color: "blue" },
    ];

    (res as AppResponse).data(
      {
        customers,
        stats,
        pagination: {
          total,
          totalPages: Math.ceil(total / limitNum),
          currentPage: pageNum,
          limit: limitNum,
        },
      },
      "Customers retrieved successfully",
    );
  },
);

/**
 * GET /api/v1/admin/customers/stats
 */
export const getCustomerStats = asyncHandler(
  async (_req: Request, res: Response) => {
    const [users, orders] = await Promise.all([
      User.find().lean(),
      Order.find().lean(),
    ]);

    const totalCustomers = users.length;
    const activeCustomers = users.filter((u) =>
      orders.some((o) => o.userId.toString() === u._id.toString()),
    ).length;
    const inactiveCustomers = totalCustomers - activeCustomers;
    const totalRevenue = orders.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );
    const avgOrderValue = orders.length
      ? Math.round(totalRevenue / orders.length)
      : 0;
    const refunds = orders.filter((o) => o.orderStatus === "refunded").length;

    (res as AppResponse).data(
      [
        {
          label: "Total Customers",
          value: String(totalCustomers),
          color: "purple",
        },
        {
          label: "Active Customers",
          value: String(activeCustomers),
          color: "orange",
        },
        {
          label: "Inactive Customers",
          value: String(inactiveCustomers),
          color: "cyan",
        },
        {
          label: "Avg. Order Value",
          value: `₦${avgOrderValue.toLocaleString()}`,
          color: "red",
        },
        { label: "Refunds", value: String(refunds), color: "blue" },
      ],
      "Customer stats retrieved",
    );
  },
);

/**
 * GET /api/v1/admin/customers/:id
 */
export const getSingleCustomer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const user = await User.findById(id).lean();
    if (!user) return next(new AppError("Customer not found", 404));

    const orders = await Order.find({ userId: id })
      .sort({ createdAt: -1 })
      .lean();
    const base = formatCustomer(user, orders);

    const purchaseHistory = orders.map((o) => ({
      orderId: `#${o.orderNumber}`,
      date: formatDate(o.createdAt),
      items: o.items?.length ?? 0,
      amount: o.totalAmount ?? 0,
      status: capitaliseStatus(o.orderStatus),
    }));

    // const loyaltyProgress = calculateLoyaltyProgress(user, orders);
    const loyaltyData = calculateLoyaltyProgress(user, orders);

    const customerActivity = buildCustomerActivity(user, orders);

    (res as AppResponse).data(
      {
        ...base,
        purchaseHistory,
        customerActivity,
        loyaltyProgress: loyaltyData.history,
        totalLoyaltyPoints: loyaltyData.totalPoints,
      },
      "Customer retrieved",
    );
  },
);

/**
 * GET /api/v1/admin/customers/:id/orders
 */
export const getCustomerOrders = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const orders = await Order.find({ userId: id })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = orders.map((o) => ({
      orderId: `#${o.orderNumber}`,
      date: formatDate(o.createdAt),
      items: o.items?.length ?? 0,
      amount: o.totalAmount ?? 0,
      status: capitaliseStatus(o.orderStatus),
    }));

    (res as AppResponse).data(formatted, "Customer orders retrieved");
  },
);

/**
 * GET /api/v1/admin/customers/export
 * Returns a CSV file of all customers matching current filters.
 * Query params: search, status, badge, dateFrom, dateTo
 */
export const exportCustomers = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      search = "",
      status = "all",
      badge = "all",
      dateFrom,
      dateTo,
    } = req.query;

    const query = buildUserQuery({
      search: search as string,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    });

    const users = await User.find(query).sort({ createdAt: -1 }).lean();

    const userIds = users.map((u) => u._id);

    const groupedOrders = await Order.aggregate([
      { $match: { userId: { $in: userIds } } },
      {
        $group: {
          _id: "$userId",
          orders: { $push: "$$ROOT" },
        },
      },
    ]);

    const ordersByUser: Record<string, any[]> = {};

    for (const group of groupedOrders) {
      ordersByUser[group._id.toString()] = group.orders;
    }

    let customers = users.map((user) =>
      formatCustomer(user, ordersByUser[user._id.toString()] ?? []),
    );

    if (status === "active")
      customers = customers.filter((c) => c.status === "Active");
    if (status === "inactive")
      customers = customers.filter((c) => c.status === "In-active");
    if (badge === "frequent_buyer")
      customers = customers.filter((c) => c.badges.includes("Frequent Buyer"));
    if (badge === "new_user")
      customers = customers.filter((c) => c.badges.includes("New User"));

    // Build CSV
    const headers = [
      "Customer ID",
      "Name",
      "Email",
      "Phone Number",
      "Region",
      "Address",
      "Total Orders",
      "Total Spent (₦)",
      "Avg Order Value (₦)",
      "Date Joined",
      "Last Activity",
      "Status",
      "Badges",
    ];

    const rows = customers.map((c) => [
      c.customerId,
      `"${c.name}"`,
      c.email,
      c.phone,
      c.region,
      `"${c.address}"`,
      c.totalOrders,
      c.totalSpent,
      c.stats.averageOrderValue,
      c.dateJoined,
      c.lastActivity,
      c.status,
      `"${c.badges.join(", ")}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="customers-${new Date().toISOString().split("T")[0]}.csv"`,
    );
    res.status(200).send(csv);
  },
);

//function to calculate loyalty progress
function calculateLoyaltyProgress(user: any, orders: any[]) {
  const progress: any[] = [];

  let totalPoints = 0;

  const signupPoints = 10;
  totalPoints += signupPoints;

  progress.push({
    rawDate: user.createdAt,
    date: formatDate(user.createdAt),
    event: "Account Created",
    points: signupPoints,
  });

  for (const order of orders) {
    let points = 0;

    const amount = order.totalAmount ?? 0;
    const items = order.items?.length ?? 0;

    // Penalty
    if (order.orderStatus === "cancelled") {
      const penalty = -10;

      totalPoints += penalty;

      progress.push({
        rawDate: order.createdAt,
        date: formatDate(order.createdAt),
        event: "Order Cancelled",
        points: penalty,
      });
      continue;
    }

    // Base points (₦1000 = 1 point)
    points += Math.floor(amount / 1000);

    // Bonus rules
    if (amount >= 50000) points += 20;
    if (items >= 5) points += 10;

    totalPoints += points;

    // Normal order
    progress.push({
      rawDate: order.createdAt,
      date: formatDate(order.createdAt),
      event: "Order Completed",
      points,
    });
  }

  return {
    history: progress.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.rawDate).getTime(),
    ),
    totalPoints,
  };
}

//function to show customer's activities
function buildCustomerActivity(user: any, orders: any[]) {
  const activities: any[] = [];

  activities.push({
    date: formatDate(user.createdAt),
    activity: "Account Created",
    details: "User registered",
    status: "Successful",
  });

  for (const order of orders) {
    activities.push({
      date: formatDate(order.createdAt),
      activity: "Order Placed",
      details: `Order #${order.orderNumber}`,
      status: order.orderStatus === "cancelled" ? "Failed" : "Successful",
    });
  }

  return activities.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
