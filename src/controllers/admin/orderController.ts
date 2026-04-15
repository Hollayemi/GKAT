import { Request, Response, NextFunction } from "express";
import Order, { OrderStatus } from "../../models/Orders";
import User, { IUser } from "../../models/User";
import { AppError, asyncHandler, AppResponse } from "../../middleware/error";
import mongoose from "mongoose";
import Product from "../../models/admin/Product";
import StaffModel, { IStaff } from "../../models/admin/Staff.model";

function buildOrderStatusFilter(status: string): OrderStatus | null {
  const map: Record<string, OrderStatus> = {
    pending: "pending",
    confirmed: "confirmed",
    processing: "processing",
    shipped: "shipped",
    delivered: "delivered",
    cancelled: "cancelled",
    returned: "returned",
    refunded: "refunded",
  };
  return map[status.toLowerCase()] ?? null;
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";

  const d = new Date(date);

  const datePart = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const timePart = d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart} - ${timePart}`;
}


async function formatOrder(order: any) {
  return {
    orderId: order.orderNumber,

    customerName: order.userId?.name || "",
    customerEmail: order.userId?.email || "",
    customerPhone: order.userId?.phoneNumber || "",

    // deliveryAddress: order.shippingAddress || "",
    deliveryAddress: order.shippingAddress?.address || "",

    totalAmount: order.totalAmount,
    items: order.items.length,

    status: order.orderStatus,

    dateOrdered: formatDate(order.createdAt),
    deliveryDate: formatDate(order.actualDelivery),

    courierName: order.carrier || "-",

    orderedItems: order.items.map((item: any) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
    })),

    activityTimeline: order.statusHistory.map((s: any) => ({
      time: s.timestamp,
      event: s.status,
    })),
  };
}

// @desc    Get all orders with pagination, search and status filter
// @route   GET /api/v1/admin/orders
// @access  Private/Admin
export const getAllOrders = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { 
      page = 1, 
      limit = 9, 
      status = "all", 
      search = "", 
      startDate, 
      endDate, 
      minAmount, 
      maxAmount, 
      region 
    } = req.query;

    const query: any = {};

    if (status !== "all") {
      const mapped = buildOrderStatusFilter(status as string);
      if (!mapped) return next(new AppError("Invalid status value", 400));
      query.orderStatus = mapped;
    }

    if (region) {
      query.region = { $regex: region as string, $options: "i" };
    }

    if (minAmount || maxAmount) {
      query.totalAmount = {};
      if (minAmount) query.totalAmount.$gte = Number(minAmount);
      if (maxAmount) query.totalAmount.$lte = Number(maxAmount);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    if ((search as string).trim()) {
      const s = (search as string).trim();
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: s, $options: "i" } },
          { email: { $regex: s, $options: "i" } }
        ]
      }).select('_id');
      
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { orderNumber: { $regex: s, $options: "i" } },
        { userId: { $in: userIds } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("userId", "name email phoneNumber")
        .populate("shippingAddress")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query),
    ]);

    const formattedOrders = await Promise.all(
      orders.map((order) => formatOrder(order))
    );

    const statsRaw = await Order.getOrderStats();
    const statMap = statsRaw.reduce<Record<string, { count: number; totalAmount: number }>>((acc, s) => {
      acc[s._id] = { count: s.count, totalAmount: s.totalAmount };
      return acc;
    }, {});

    const totalOrders = statsRaw.reduce((sum, s) => sum + s.count, 0);
    const revenue = statMap["delivered"]?.totalAmount ?? 0;

    const stats = [
      { label: "Total Orders", value: String(totalOrders), color: "purple" },
      { label: "Processing", value: String(statMap["processing"]?.count ?? 0), color: "orange" },
      { label: "Delivered", value: String(statMap["delivered"]?.count ?? 0), color: "green" },
      { label: "Cancelled", value: String(statMap["cancelled"]?.count ?? 0), color: "red" },
      { label: "Revenue", value: `₦${revenue.toLocaleString()}`, color: "blue" },
    ];

    (res as AppResponse).data(
      {
        orders: formattedOrders,
        stats,
        pagination: {
          total,
          totalPages: Math.ceil(total / limitNum),
          currentPage: pageNum,
          limit: limitNum,
        },
      },
      "Orders retrieved successfully",
    );
  },
);

export const getOrderById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber })
      .populate("userId", "name email phoneNumber")
      .populate("shippingAddress")
      .lean();

    if (!order) return next(new AppError("Order not found", 404));

    // Fixed: Added await for the async formatOrder function
    const formattedOrder = await formatOrder(order);

    (res as AppResponse).data(
      { order: formattedOrder },
      "Order retrieved successfully",
    );
  },
);

// export const getAllOrders = asyncHandler(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const { page = 1, limit = 9, status = "all", search = "",startDate,
//   endDate,
//   minAmount,
//   maxAmount,
//   region, } = req.query;

//     const query: any = {};

//     // Status filter — uses orderStatus (the real field name in the model)
//     if (status !== "all") {
//       const mapped = buildOrderStatusFilter(status as string);
//       if (!mapped) return next(new AppError("Invalid status value", 400));
//       query.orderStatus = mapped;
//     }

//     // Search by orderNumber, orderSlug, or customer name via userId populate
//     const ordersRaw = await Order.find(query)
//       .populate("userId", "name email phone")
//       .sort({ createdAt: -1 })
//       .lean();

//     // ✅ SEARCH (AFTER POPULATE)
//     let filteredOrders = ordersRaw;

//     if ((search as string).trim()) {
//       const s = (search as string).toLowerCase();

//       filteredOrders = ordersRaw.filter((order: any) => {
//         return (
//           order.orderNumber?.toLowerCase().includes(s) ||
//           order.userId?.name?.toLowerCase().includes(s) ||
//           order.userId?.email?.toLowerCase().includes(s)
//         );
//       });
//     }


//     if (startDate || endDate) {
//   query.createdAt = {};

//   if (startDate) {
//     query.createdAt.$gte = new Date(startDate as string);
//   }

//   if (endDate) {
//     query.createdAt.$lte = new Date(endDate as string);
//   }
// }

//  // ✅ REGION FILTER
//     if (region) {
//       query.region = region;
//     }

//     // ✅ AMOUNT FILTER
//     if (minAmount || maxAmount) {
//       query.totalAmount = {};

//       if (minAmount) query.totalAmount.$gte = Number(minAmount);
//       if (maxAmount) query.totalAmount.$lte = Number(maxAmount);
//     }


//     const pageNum = parseInt(page as string);
//     const limitNum = parseInt(limit as string);
//     const skip = (pageNum - 1) * limitNum;

//     const [orders, total] = await Promise.all([
//       Order.find(query)
//         .populate("userId", "name email phone")
//         .populate("shippingAddress")
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limitNum)
//         .lean(),
//       Order.countDocuments(query),
//     ]);

//     /**
//      * Convert DB orders to UI format
//      */
//     // const formattedOrders = orders.map(formatOrder);
//     const formattedOrders = await Promise.all(
//   orders.map((order) => formatOrder(order))
// );



//     /**
//      * Order statistics
//      */
//     const statsRaw = await Order.getOrderStats();

//     const statMap = statsRaw.reduce<
//       Record<string, { count: number; totalAmount: number }>
//     >((acc, s) => {
//       acc[s._id] = { count: s.count, totalAmount: s.totalAmount };
//       return acc;
//     }, {});

//     const totalOrders = statsRaw.reduce((sum, s) => sum + s.count, 0);
//     const revenue = statMap["delivered"]?.totalAmount ?? 0;

//     const stats = [
//       { label: "Total Orders", value: String(totalOrders), color: "purple" },
//       {
//         label: "Processing",
//         value: String(statMap["processing"]?.count ?? 0),
//         color: "orange",
//       },
//       {
//         label: "Delivered",
//         value: String(statMap["delivered"]?.count ?? 0),
//         color: "green",
//       },
//       {
//         label: "Cancelled",
//         value: String(statMap["cancelled"]?.count ?? 0),
//         color: "red",
//       },
//       {
//         label: "Revenue",
//         value: `₦${revenue.toLocaleString()}`,
//         color: "blue",
//       },
//     ];

//     (res as AppResponse).data(
//       {
//         orders: formattedOrders,
//         stats,
//         pagination: {
//           total,
//           totalPages: Math.ceil(total / limitNum),
//           currentPage: pageNum,
//           limit: limitNum,
//         },
//       },
//       "Orders retrieved successfully",
//     );
//   },
// );

// // @desc    Get single order by orderNumber
// // @route   GET /api/v1/admin/orders/:orderNumber
// // @access  Private/Admin
// export const getOrderById = asyncHandler(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const { orderNumber } = req.params;

//     const order = await Order.findOne({ orderNumber })
//       .populate("userId", "name email phone")
//       // .populate('shippingAddress', 'label fullname address phone state city')
//       .lean();

//     if (!order) return next(new AppError("Order not found", 404));

//     const formattedOrder = formatOrder(order);

//     (res as AppResponse).data(
//       { order: formattedOrder },
//       "Order retrieved successfully",
//     );
//   },
// );

// @desc    Cancel an order
// @route   PATCH /api/v1/admin/orders/:orderNumber/cancel
// @access  Private/Admin



export const cancelOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Not authenticated", 401));

    const { orderNumber } = req.params;
    const { reason, note, password } = req.body;

    if (!reason || !note || !password) {
      return next(new AppError("reason, note, and password are required", 400));
    }

    // User.findById with '+password' to include the select:false password field
    const admin = (await StaffModel.findById(req.user.id).select("+password")) as
      | (IStaff & {
          comparePassword?: (p: string) => Promise<boolean>;
        })
      | null;

      if (!admin) return next(new AppError("Admin not found", 404));
      
  
    console.log("Verify Admin:", admin?.email);
    const isMatch =  admin.comparePassword(password);
    console.log("isMatch:", isMatch, password);
    if (!isMatch) return next(new AppError("Incorrect password", 401));

    const order = await Order.findOne({ orderNumber });
    if (!order) return next(new AppError("Order not found", 404));

    if (order.orderStatus === "cancelled") {
      return next(new AppError("Order is already cancelled", 400));
    }
    if (order.orderStatus === "delivered") {
      return next(new AppError("Cannot cancel a delivered order", 400));
    }

    // Use the model&apos;sbuilt-in cancelOrder method which handles
    // orderStatus, cancellationReason, statusHistory, and refund logic
    await order.cancelOrder(`${reason} — ${note}`, req.user.id);

    (res as AppResponse).data({ order }, "Order cancelled successfully");
  },
);

// @desc    Update order status
// @route   PATCH /api/v1/admin/orders/:orderNumber/status
// @access  Private/Admin
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Not authenticated", 401));

    const { orderNumber } = req.params;
    const { status, note } = req.body;

    if (!status) return next(new AppError("status is required", 400));

    const newStatus = buildOrderStatusFilter(status);
    if (!newStatus) return next(new AppError("Invalid status value", 400));

    const order = await Order.findOne({ orderNumber });
    if (!order) return next(new AppError("Order not found", 404));

    // Use the model&apos;sbuilt-in updateStatus method which also
    // pushes to statusHistory and sets actualDelivery/estimatedDelivery
    await order.updateStatus(newStatus, note ?? "", req.user.id);

    (res as AppResponse).data({ order }, "Order status updated successfully");
  },
);

// @desc    Transfer an order to a different courier / add tracking
// @route   PATCH /api/v1/admin/orders/:orderNumber/transfer
// @access  Private/Admin
export const transferOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Not authenticated", 401));

    const { orderNumber } = req.params;
    const { trackingNumber, carrier, estimatedDelivery } = req.body;

    if (!trackingNumber && !carrier) {
      return next(
        new AppError(
          "Provide at least a trackingNumber or carrier to transfer",
          400,
        ),
      );
    }

    const order = await Order.findOne({ orderNumber });
    if (!order) return next(new AppError("Order not found", 404));

    if (
      order.orderStatus === "cancelled" ||
      order.orderStatus === "delivered"
    ) {
      return next(
        new AppError(`Cannot transfer a ${order.orderStatus} order`, 400),
      );
    }

    // Use the model&apos;sbuilt-in addTrackingInfo method http://localhost:5001/api/v1
    await order.addTrackingInfo(
      trackingNumber,
      carrier,
      estimatedDelivery ? new Date(estimatedDelivery) : undefined,
    );

    (res as AppResponse).data(
      { order },
      "Order transfer info updated successfully",
    );
  },
);
