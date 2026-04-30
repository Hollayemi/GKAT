/**
 * @swagger
 * tags:
 *   - name: Subscriptions
 *     description: Go Prime subscription plans and user subscription management
 *
 *
 * /subscriptions/plans:
 *   get:
 *     summary: Get all active subscription plans
 *     description: Returns all active Go Prime plans available for purchase.
 *     tags: [Subscriptions]
 *     security: []
 *     responses:
 *       200:
 *         description: Plans retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         plans:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/SubscriptionPlan'
 *
 * /subscriptions/my-subscription:
 *   get:
 *     summary: Get current user's active subscription
 *     description: Returns the authenticated user's currently active Go Prime subscription or null.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active subscription or null
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         subscription:
 *                           nullable: true
 *                           $ref: '#/components/schemas/UserSubscription'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/history:
 *   get:
 *     summary: Get subscription history
 *     description: Returns all past and current subscriptions for the authenticated user.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Subscription history
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         subscriptions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/UserSubscription'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/subscribe:
 *   post:
 *     summary: Subscribe to a Go Prime plan
 *     description: |
 *       Initiates a subscription purchase. Creates a pending subscription record and
 *       initialises payment via the chosen provider. After payment is confirmed
 *       (via webhook or callback), the subscription is automatically activated and the
 *       user's discount is applied to all future orders until the subscription expires.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId:
 *                 type: string
 *                 description: SubscriptionPlan ObjectId
 *                 example: "683a578d7892bde7a4663d28"
 *               paymentMethod:
 *                 type: string
 *                 enum: [paystack, opay, palmpay, cash_on_delivery]
 *                 default: paystack
 *     responses:
 *       201:
 *         description: Subscription initiated — payment URL returned
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         subscription:
 *                           type: object
 *                           properties:
 *                             _id: { type: string }
 *                             planName: { type: string }
 *                             discountPercentage: { type: number }
 *                             durationDays: { type: integer }
 *                             amountPaid: { type: number }
 *                             status: { type: string, example: "pending_payment" }
 *                         payment:
 *                           type: object
 *                           description: Payment gateway initialisation response (authorization_url etc.)
 *       400:
 *         description: Already has active subscription or plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/cancel:
 *   post:
 *     summary: Cancel active subscription
 *     description: |
 *       Marks the subscription as cancelled. The Go Prime benefits remain active
 *       until the end of the already-paid billing period.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "No longer needed"
 *     responses:
 *       200:
 *         description: Subscription cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       404:
 *         description: No active subscription found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/verify-payment:
 *   post:
 *     summary: Manually verify subscription payment
 *     description: |
 *       Fallback endpoint to manually verify a subscription payment if the
 *       webhook/callback was not received. Use the same `reference` returned
 *       by `/subscriptions/subscribe`.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reference]
 *             properties:
 *               reference:
 *                 type: string
 *                 example: "PAY_SUB_6821234_1714000000000"
 *               provider:
 *                 type: string
 *                 enum: [paystack, opay, palmpay]
 *                 default: paystack
 *     responses:
 *       200:
 *         description: Subscription activated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         subscription:
 *                           $ref: '#/components/schemas/UserSubscription'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *
 * /admin/subscription-plans:
 *   get:
 *     summary: Get all subscription plans (admin)
 *     description: Returns all plans with active subscriber counts. Filterable by isActive.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: isActive
 *         in: query
 *         schema: { type: boolean }
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Plans with stats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *   post:
 *     summary: Create subscription plan (admin)
 *     description: |
 *       Creates a new Go Prime plan. `durationDays` must be one of: 7, 30, 90, 180, 365.
 *       `discountPercentage` is the flat % taken off the order subtotal (after deals and coupons).
 *       Optional `maxDiscountAmountPerOrder` caps the discount per order (e.g. max ₦2,000 off).
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscriptionPlanInput'
 *           example:
 *             name: "Go Prime Monthly"
 *             description: "Get 10% off every order for 30 days"
 *             price: 2500
 *             durationDays: 30
 *             discountPercentage: 10
 *             maxDiscountAmountPerOrder: 3000
 *             features:
 *               - "10% off every order"
 *               - "Priority customer support"
 *               - "Free delivery on orders above ₦5,000"
 *             badgeColor: "gold"
 *     responses:
 *       201:
 *         description: Plan created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /admin/subscription-plans/subscriptions:
 *   get:
 *     summary: Get all user subscriptions (admin)
 *     description: Returns all user subscriptions with filters and revenue stats.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending_payment, active, expired, cancelled]
 *       - name: planId
 *         in: query
 *         schema: { type: string }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Search by user name, email or phone
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Subscriptions with stats
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         subscriptions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/UserSubscription'
 *                         stats:
 *                           type: object
 *                           properties:
 *                             activeSubscribers: { type: integer }
 *                             totalRevenue: { type: number }
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /admin/subscription-plans/{id}:
 *   get:
 *     summary: Get single subscription plan (admin)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plan with stats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   put:
 *     summary: Update subscription plan (admin)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscriptionPlanInput'
 *     responses:
 *       200:
 *         description: Plan updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *   delete:
 *     summary: Delete subscription plan (admin)
 *     description: Fails if any users currently have an active subscription to this plan.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plan deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Cannot delete – active subscribers exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /admin/subscription-plans/{id}/toggle:
 *   patch:
 *     summary: Toggle plan active status (admin)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plan toggled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *
 * components:
 *   schemas:
 *     SubscriptionPlanInput:
 *       type: object
 *       required: [name, description, price, durationDays, discountPercentage]
 *       properties:
 *         name:
 *           type: string
 *           example: "Go Prime Monthly"
 *         description:
 *           type: string
 *           example: "10% off every order for 30 days"
 *         price:
 *           type: number
 *           example: 2500
 *         durationDays:
 *           type: integer
 *           enum: [7, 30, 90, 180, 365]
 *           example: 30
 *         discountPercentage:
 *           type: number
 *           minimum: 1
 *           maximum: 100
 *           example: 10
 *         maxDiscountAmountPerOrder:
 *           type: number
 *           nullable: true
 *           description: Optional hard cap on discount per order (e.g. max ₦2,000 saved)
 *           example: 3000
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           example: ["10% off every order", "Priority support"]
 *         badgeColor:
 *           type: string
 *           example: "gold"
 *         isActive:
 *           type: boolean
 *           default: true
 *
 *     SubscriptionPlan:
 *       allOf:
 *         - $ref: '#/components/schemas/SubscriptionPlanInput'
 *         - type: object
 *           properties:
 *             _id:
 *               type: string
 *             durationLabel:
 *               type: string
 *               example: "1 Month"
 *             createdAt:
 *               type: string
 *               format: date-time
 *             updatedAt:
 *               type: string
 *               format: date-time
 *
 *     UserSubscription:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         planId:
 *           $ref: '#/components/schemas/SubscriptionPlan'
 *         status:
 *           type: string
 *           enum: [pending_payment, active, expired, cancelled]
 *         startDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         endDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         amountPaid:
 *           type: number
 *         paymentMethod:
 *           type: string
 *         paymentStatus:
 *           type: string
 *           enum: [pending, completed, failed]
 *         isActive:
 *           type: boolean
 *           description: Virtual — true when status=active and endDate > now
 *         daysRemaining:
 *           type: integer
 *           description: Virtual — days left in subscription
 *         planSnapshot:
 *           type: object
 *           properties:
 *             name: { type: string }
 *             discountPercentage: { type: number }
 *             maxDiscountAmountPerOrder: { type: number, nullable: true }
 *             durationDays: { type: integer }
 *         createdAt:
 *           type: string
 *           format: date-time
 */
export {};