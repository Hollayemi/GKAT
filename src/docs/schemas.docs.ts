/**
 * @swagger
 * components:
 *
 *   # ─── Security ──────────────────────────────────────────────────
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: |
 *         JWT issued by `/auth/verify-otp` or `/auth/verify-login-otp`.
 *         Pass it as: `Authorization: Bearer <token>`
 *
 *   # ─── Reusable Responses ─────────────────────────────────────────
 *   responses:
 *     Unauthorized:
 *       description: Missing or invalid JWT
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *     NotFound:
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *     BadRequest:
 *       description: Validation error or missing required fields
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *     ServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *
 *   # ─── Schemas ────────────────────────────────────────────────────
 *   schemas:
 *
 *     # ── Envelopes ─────────────────────────────────────────────────
 *     SuccessEnvelope:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         type:
 *           type: string
 *           example: success
 *         message:
 *           type: string
 *           example: "Operation successful"
 *         data:
 *           description: Response payload (varies by endpoint)
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         type:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 *           example: "Resource not found"
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 20
 *         total:
 *           type: integer
 *           example: 150
 *         pages:
 *           type: integer
 *           example: 8
 *
 *     # ── Auth ──────────────────────────────────────────────────────
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Login successful"
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/UserPublic'
 *             token:
 *               type: string
 *               description: JWT access token (7d expiry)
 *             refreshToken:
 *               type: string
 *               description: JWT refresh token (30d expiry)
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     UserPublic:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Oluwasusi Stephen"
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *         phoneNumber:
 *           type: string
 *           example: "+2348147702684"
 *         role:
 *           type: string
 *           enum: [user, driver, admin]
 *         avatar:
 *           type: string
 *           nullable: true
 *         isPhoneVerified:
 *           type: boolean
 *         referralCode:
 *           type: string
 *         residentArea:
 *           type: string
 *
 *     # ── Address ───────────────────────────────────────────────────
 *     AddressInput:
 *       type: object
 *       required: [label, landmark, localGovernment, phone, state, street, address]
 *       properties:
 *         label:
 *           type: string
 *           enum: [Home, Shop, Office, Other]
 *           example: "Home"
 *         landmark:
 *           type: string
 *           example: "Pyakasa Junction"
 *         localGovernment:
 *           type: string
 *           example: "Abuja Municipal"
 *         phone:
 *           type: string
 *           example: "08147702684"
 *         state:
 *           type: string
 *           example: "FCT"
 *         street:
 *           type: string
 *           example: "eGoshen Estate"
 *         address:
 *           type: string
 *           example: "55, Giwa-Amu, Airport Road, Abuja"
 *         isDefault:
 *           type: boolean
 *           default: false
 *         coordinates:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *               example: 9.0765
 *             lng:
 *               type: number
 *               example: 7.3986
 *
 *     Address:
 *       allOf:
 *         - $ref: '#/components/schemas/AddressInput'
 *         - type: object
 *           properties:
 *             _id:
 *               type: string
 *             userId:
 *               type: string
 *             formattedAddress:
 *               type: string
 *               description: Virtual, street + landmark + localGovernment
 *             createdAt:
 *               type: string
 *               format: date-time
 *             updatedAt:
 *               type: string
 *               format: date-time
 *
 *     # ── Category ──────────────────────────────────────────────────
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Fruits & Vegetables"
 *         icon:
 *           type: string
 *           nullable: true
 *           description: Cloudinary URL
 *         isActive:
 *           type: boolean
 *         order:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     # ── Region ────────────────────────────────────────────────────
 *     Region:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Surulere"
 *         coordinate:
 *           type: object
 *           properties:
 *             point:
 *               type: string
 *               example: "Point"
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               description: "[longitude, latitude]"
 *               example: [3.3515, 6.5041]
 *         isActive:
 *           type: boolean
 *         order:
 *           type: integer
 *
 *     # ── Product ───────────────────────────────────────────────────
 *     Product:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         productId:
 *           type: string
 *           example: "PROD-123456"
 *         sku:
 *           type: string
 *           example: "GK-123456"
 *         productName:
 *           type: string
 *           example: "Indomie Instant Noodles"
 *         brand:
 *           type: string
 *           nullable: true
 *         category:
 *           $ref: '#/components/schemas/Category'
 *         status:
 *           type: string
 *           enum: [active, inactive, draft]
 *         description:
 *           type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         salesPrice:
 *           type: number
 *           example: 3500
 *         unitType:
 *           type: string
 *           enum: [single, pack, carton, kg, litre, box]
 *         unitQuantity:
 *           type: number
 *         stockQuantity:
 *           type: integer
 *         minimumStockAlert:
 *           type: integer
 *         dealInfo:
 *           type: object
 *           nullable: true
 *           properties:
 *             percentage:
 *               type: number
 *             startDate:
 *               type: string
 *               format: date-time
 *             endDate:
 *               type: string
 *               format: date-time
 *             status:
 *               type: string
 *               enum: [active, inactive]
 *         variants:
 *           type: array
 *           items:
 *             type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     ProductOverview:
 *       type: object
 *       properties:
 *         totalProducts:
 *           type: object
 *           properties:
 *             value: { type: integer }
 *             change: { type: string, example: "+5.2% vs last month" }
 *             color: { type: string }
 *         inStock:
 *           type: object
 *           properties:
 *             value: { type: integer }
 *             change: { type: string }
 *             color: { type: string }
 *         lowStock:
 *           type: object
 *           properties:
 *             value: { type: integer }
 *             change: { type: string }
 *             color: { type: string }
 *         outOfStock:
 *           type: object
 *           properties:
 *             value: { type: integer }
 *             change: { type: string }
 *             color: { type: string }
 *         categories:
 *           type: object
 *           properties:
 *             value: { type: integer }
 *             change: { type: string }
 *             color: { type: string }
 *
 *     # ── Cart ──────────────────────────────────────────────────────
 *     CartDetail:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartItem'
 *         appliedCoupons:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AppliedCoupon'
 *         pricing:
 *           type: object
 *           properties:
 *             originalSubtotal:
 *               type: number
 *               description: Sum of original prices before deals
 *             dealDiscount:
 *               type: number
 *               description: Total discount from deal-of-the-day
 *             subtotal:
 *               type: number
 *               description: After deals, before coupons
 *             couponDiscount:
 *               type: number
 *             discountedSubtotal:
 *               type: number
 *             totalAmount:
 *               type: number
 *         totalItems:
 *           type: integer
 *         totalSavings:
 *           type: number
 *         hasUnavailableItems:
 *           type: boolean
 *         deliveryMethod:
 *           type: string
 *           enum: [pickup, delivery]
 *           nullable: true
 *         isActive:
 *           type: boolean
 *
 *     CartItem:
 *       type: object
 *       properties:
 *         productId:
 *           type: string
 *         variantId:
 *           type: string
 *           nullable: true
 *         name:
 *           type: string
 *         brand:
 *           type: string
 *           nullable: true
 *         image:
 *           type: string
 *           nullable: true
 *         quantity:
 *           type: integer
 *         unitType:
 *           type: string
 *         unitQuantity:
 *           type: number
 *         originalPrice:
 *           type: number
 *         effectivePrice:
 *           type: number
 *         dealDiscount:
 *           type: number
 *         hasDeal:
 *           type: boolean
 *         totalOriginalPrice:
 *           type: number
 *         totalEffectivePrice:
 *           type: number
 *         unavailable:
 *           type: boolean
 *
 *     AppliedCoupon:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *         promotionName:
 *           type: string
 *         promoType:
 *           type: string
 *         discountValue:
 *           type: number
 *         discountAmount:
 *           type: number
 *
 *     CouponSummary:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         discountType:
 *           type: string
 *         discountValue:
 *           type: number
 *         minimumOrderValue:
 *           type: number
 *
 *     # ── Order ─────────────────────────────────────────────────────
 *     Order:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         orderNumber:
 *           type: string
 *           example: "ORD-260422-123456"
 *         orderSlug:
 *           type: string
 *           example: "ABCD1234"
 *         userId:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             type: object
 *         shippingAddress:
 *           type: string
 *           description: Address ObjectId or populated Address object
 *         deliveryMethod:
 *           type: string
 *           enum: [delivery, pickup]
 *         region:
 *           type: string
 *           nullable: true
 *           description: Resolved delivery region ObjectId
 *         orderStatus:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled, returned, refunded]
 *         paymentInfo:
 *           type: object
 *           properties:
 *             method:
 *               type: string
 *             paymentStatus:
 *               type: string
 *             amount:
 *               type: number
 *         subtotal:
 *           type: number
 *         deliveryFee:
 *           type: number
 *         serviceCharge:
 *           type: number
 *         discount:
 *           type: number
 *         totalAmount:
 *           type: number
 *         statusHistory:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               status: { type: string }
 *               timestamp: { type: string, format: date-time }
 *               note: { type: string }
 *         appliedCoupons:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AppliedCoupon'
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     # ── Advert ────────────────────────────────────────────────────
 *     Advert:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         image:
 *           type: string
 *           description: Cloudinary URL
 *         targetUrl:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *         position:
 *           type: string
 *           enum: [top, bottom, sidebar]
 *         clicks:
 *           type: integer
 *         startDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         endDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     # ── Payment ───────────────────────────────────────────────────
 *     PaymentMethod:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "paystack"
 *         name:
 *           type: string
 *           example: "Paystack"
 *         description:
 *           type: string
 *         logo:
 *           type: string
 *         enabled:
 *           type: boolean
 *         sortOrder:
 *           type: integer
 *
 *     # ── Rider / Driver ────────────────────────────────────────────
 *     Driver:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: object
 *           description: Populated User document
 *           properties:
 *             name: { type: string }
 *             email: { type: string }
 *             phoneNumber: { type: string }
 *             avatar: { type: string, nullable: true }
 *         phone:
 *           type: string
 *         vehicleType:
 *           type: string
 *           enum: [motorcycle, bicycle, car, van, truck]
 *         vehicleModel:
 *           type: string
 *           nullable: true
 *         vehiclePlateNumber:
 *           type: string
 *         vehicleColor:
 *           type: string
 *           nullable: true
 *         profilePhoto:
 *           type: string
 *           nullable: true
 *         region:
 *           type: string
 *         employmentType:
 *           type: string
 *           enum: [full-time, part-time, contract]
 *         status:
 *           type: string
 *           enum: [pending, active, suspended, disabled, on-delivery]
 *         verificationStatus:
 *           type: string
 *           enum: [pending, verified, rejected]
 *         isOnline:
 *           type: boolean
 *         totalDeliveries:
 *           type: integer
 *         completedDeliveries:
 *           type: integer
 *         cancelledDeliveries:
 *           type: integer
 *         rating:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         joinedDate:
 *           type: string
 *           format: date-time
 *
 *     DriverDelivery:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         orderId:
 *           type: string
 *         driverId:
 *           type: string
 *         userId:
 *           type: string
 *         orderNumber:
 *           type: string
 *         pickupAddress:
 *           type: string
 *         deliveryAddress:
 *           type: string
 *         distanceKm:
 *           type: number
 *         status:
 *           type: string
 *           enum: [pending_acceptance, accepted, arrived_at_store, picked_up, in_transit, arrived_at_customer, delivered, cancelled, rejected]
 *         fareBreakdown:
 *           type: object
 *           properties:
 *             baseFare: { type: number }
 *             distanceBonus: { type: number }
 *             priorityFee: { type: number }
 *             totalEarned: { type: number }
 *         pinVerified:
 *           type: boolean
 *         isPaid:
 *           type: boolean
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         statusHistory:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               status: { type: string }
 *               timestamp: { type: string, format: date-time }
 *               note: { type: string, nullable: true }
 *
 *     WalletSummary:
 *       type: object
 *       properties:
 *         balance:
 *           type: number
 *           example: 12500
 *         totalEarned:
 *           type: number
 *         totalWithdrawn:
 *           type: number
 *         totalDeliveries:
 *           type: integer
 *
 *     WalletDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/WalletSummary'
 *         - type: object
 *           properties:
 *             bankAccounts:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   bankName: { type: string }
 *                   accountNumber: { type: string }
 *                   accountName: { type: string }
 *                   isDefault: { type: boolean }
 *             autoPayoutSettings:
 *               type: object
 *               properties:
 *                 enabled: { type: boolean }
 *                 frequency: { type: string }
 *                 minimumBalance: { type: number }
 *             stats:
 *               type: object
 *               properties:
 *                 today:
 *                   type: object
 *                   properties:
 *                     earned: { type: number }
 *                     deliveries: { type: integer }
 *                 thisWeek:
 *                   type: object
 *                   properties:
 *                     earned: { type: number }
 *                     deliveries: { type: integer }
 *                 thisMonth:
 *                   type: object
 *                   properties:
 *                     earned: { type: number }
 *                     deliveries: { type: integer }
 *
 *     # ── Notification ──────────────────────────────────────────────
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         title:
 *           type: string
 *         body:
 *           type: string
 *         type:
 *           type: string
 *           enum: [order, promotion, system, message, payment, review]
 *         unread:
 *           type: integer
 *           enum: [0, 1]
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         clickUrl:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 */
export {};
