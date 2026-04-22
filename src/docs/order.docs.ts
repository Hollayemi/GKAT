/**
 * @swagger
 * tags:
 *   - name: Orders
 *     description: Order lifecycle, create, track, cancel and re-pay orders
 *
 * /order:
 *   post:
 *     summary: Create order from cart
 *     description: |
 *       Converts the user's active cart into a confirmed order.
 *       - Validates stock availability for all cart items
 *       - Resolves the nearest delivery region from the shipping address coordinates
 *       - Initialises payment with the chosen provider (Paystack, OPay, PalmPay, Cash on Delivery)
 *       - Deducts stock (global + regional) and increments coupon usage counters
 *       - Sends an in-app order confirmation notification
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shippingAddress, deliveryMethod, paymentMethod]
 *             properties:
 *               shippingAddress:
 *                 type: string
 *                 description: Address document ID from `/addresses`
 *                 example: "69283f659a8dbf2e87fa390b"
 *               deliveryMethod:
 *                 type: string
 *                 enum: [delivery, pickup]
 *                 example: "delivery"
 *               paymentMethod:
 *                 type: string
 *                 enum: [paystack, opay, palmpay, cash_on_delivery]
 *                 example: "paystack"
 *               notes:
 *                 type: string
 *                 description: Optional delivery instructions
 *                 example: "Leave at the gate"
 *     responses:
 *       201:
 *         description: Order created and payment initialised
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
 *                         order:
 *                           $ref: '#/components/schemas/Order'
 *                         payment:
 *                           type: object
 *                           description: Payment gateway initialization response
 *                           properties:
 *                             authorization_url:
 *                               type: string
 *                               description: Redirect URL for card/online payment
 *                             reference:
 *                               type: string
 *                         region:
 *                           type: string
 *                           nullable: true
 *                           description: Resolved delivery region ID
 *       400:
 *         description: Cart is empty, stock validation failed, or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *   get:
 *     summary: Get all orders for current user
 *     description: Returns paginated list of the authenticated user's orders, optionally filtered by status.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [all, pending, confirmed, processing, shipped, delivered, cancelled, returned, refunded]
 *           default: all
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Orders retrieved
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
 *                         orders:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Order'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /order/repay:
 *   post:
 *     summary: Re-initiate payment for an existing order
 *     description: |
 *       Use this when a payment fails or expires. Creates a fresh payment session for the same order
 *       without modifying the order itself.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId:
 *                 type: string
 *                 example: "6998b4a6e8a4a3d17aae0ad8"
 *               paymentMethod:
 *                 type: string
 *                 enum: [paystack, opay, palmpay, cash_on_delivery]
 *                 default: paystack
 *                 example: "paystack"
 *     responses:
 *       201:
 *         description: Payment re-initialised
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
 *                         order:
 *                           $ref: '#/components/schemas/Order'
 *                         payment:
 *                           type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /order/stats:
 *   get:
 *     summary: Get order statistics for current user
 *     description: Returns a count and total amount breakdown by order status for the authenticated user.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order stats retrieved
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
 *                         stats:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                                 description: Order status
 *                               count:
 *                                 type: integer
 *                               totalAmount:
 *                                 type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /order/{id}:
 *   get:
 *     summary: Get single order
 *     description: Returns the full details of one of the user's orders including status history and items.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Order MongoDB ObjectId
 *         schema:
 *           type: string
 *           example: "692852a6e95525c3dad5bf70"
 *     responses:
 *       200:
 *         description: Order retrieved
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
 *                         order:
 *                           $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /order/{id}/cancel:
 *   post:
 *     summary: Cancel an order
 *     description: |
 *       Cancels an order that is in `pending` or `confirmed` status and has not been paid.
 *       If the order was paid, a refund is automatically marked.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "692852a6e95525c3dad5bf70"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Changed my mind"
 *     responses:
 *       200:
 *         description: Order cancelled
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
 *                         order:
 *                           $ref: '#/components/schemas/Order'
 *       400:
 *         description: Order cannot be cancelled (wrong status or already paid)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /order/{id}/track:
 *   get:
 *     summary: Track order status
 *     description: Returns the current status, tracking number, carrier, estimated delivery and full status history.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tracking info retrieved
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
 *                         orderNumber:
 *                           type: string
 *                         orderSlug:
 *                           type: string
 *                         status:
 *                           type: string
 *                         trackingNumber:
 *                           type: string
 *                           nullable: true
 *                         carrier:
 *                           type: string
 *                           nullable: true
 *                         estimatedDelivery:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         statusHistory:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                               timestamp:
 *                                 type: string
 *                                 format: date-time
 *                               note:
 *                                 type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /order/{id}/rate:
 *   post:
 *     summary: Rate a delivered order
 *     description: Allows the user to leave a rating (1–5) and optional review on a delivered order.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               review:
 *                 type: string
 *                 example: "Very fast delivery!"
 *     responses:
 *       200:
 *         description: Order rated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export {};
