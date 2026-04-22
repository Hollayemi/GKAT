/**
 * @swagger
 * tags:
 *   - name: Adverts
 *     description: Banner and promotional advertisement management
 *   - name: Recommendations
 *     description: Personalised and trending product recommendations
 *   - name: Payment
 *     description: Payment gateway callbacks, webhooks and service charge calculation
 *
 *
 * /adverts:
 *   get:
 *     summary: Get all adverts
 *     description: Returns a paginated list of adverts. Optionally filter by `isActive`.
 *     tags: [Adverts]
 *     security: []
 *     parameters:
 *       - name: isActive
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: sort
 *         in: query
 *         schema: { type: string, default: "position" }
 *     responses:
 *       200:
 *         description: Adverts retrieved
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
 *                         adverts:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Advert'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *
 *   post:
 *     summary: Create advert (admin)
 *     description: Creates a new advert with an image upload. Send as `multipart/form-data`.
 *     tags: [Adverts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, image]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Weekend Mega Sale"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               targetUrl:
 *                 type: string
 *                 example: "https://gokart.ng/sale"
 *               position:
 *                 type: string
 *                 enum: [top, bottom, sidebar]
 *                 default: top
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Advert banner image (JPG/PNG/WebP, max 5 MB)
 *     responses:
 *       201:
 *         description: Advert created
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
 *                         advert:
 *                           $ref: '#/components/schemas/Advert'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /adverts/{id}:
 *   get:
 *     summary: Get single advert
 *     tags: [Adverts]
 *     security: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Advert retrieved
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
 *                         advert:
 *                           $ref: '#/components/schemas/Advert'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   put:
 *     summary: Update advert (admin)
 *     description: Updates advert details. Optionally upload a new image.
 *     tags: [Adverts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               targetUrl:
 *                 type: string
 *               position:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Advert updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Delete advert (admin)
 *     description: Deletes the advert and removes its image from Cloudinary.
 *     tags: [Adverts]
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
 *         description: Advert deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /adverts/{id}/click:
 *   post:
 *     summary: Track advert click
 *     description: Increments the click counter for the advert and returns its target URL. Call this whenever a user taps an advert.
 *     tags: [Adverts]
 *     security: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Click tracked
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
 *                         targetUrl:
 *                           type: string
 *                           nullable: true
 *                         clicks:
 *                           type: integer
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /adverts/{id}/toggle:
 *   patch:
 *     summary: Toggle advert active status (admin)
 *     tags: [Adverts]
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
 *         description: Advert activated or deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *
 * /recommendation/trending:
 *   get:
 *     summary: Get trending products
 *     description: Returns products ranked by total quantity sold within the specified number of days.
 *     tags: [Recommendations]
 *     security: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: days
 *         in: query
 *         schema: { type: integer, default: 7 }
 *         description: Look-back window in days
 *     responses:
 *       200:
 *         description: Trending products retrieved
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
 *                         products:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Product'
 *                         count:
 *                           type: integer
 *
 * /recommendation/for-you:
 *   get:
 *     summary: Get personalised recommendations (auth required)
 *     description: |
 *       Returns product recommendations based on the user's order history and current cart contents.
 *       Excludes products the user has already purchased or currently has in their cart.
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Personalised recommendations
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
 *                         recommendations:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Product'
 *                         basedOn:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Category IDs the recommendations are drawn from
 *                         count:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /recommendation/cart-based:
 *   get:
 *     summary: Get cart-based recommendations (auth required)
 *     description: Recommends products from the same categories as items currently in the user's cart.
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Cart-based recommendations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /recommendation/order-based:
 *   get:
 *     summary: Get order-history-based recommendations (auth required)
 *     description: Recommends products from the categories the user orders from most frequently.
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Order-based recommendations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /recommendation/similar/{productId}:
 *   get:
 *     summary: Get similar products
 *     description: Returns products in the same category with a similar price range (±30%).
 *     tags: [Recommendations]
 *     security: []
 *     parameters:
 *       - name: productId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Similar products retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /recommendation/bought-together/{productId}:
 *   get:
 *     summary: Get frequently bought together
 *     description: Returns other products that are commonly purchased in the same order as the given product.
 *     tags: [Recommendations]
 *     security: []
 *     parameters:
 *       - name: productId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 5 }
 *     responses:
 *       200:
 *         description: Frequently bought together products
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *
 * /recommendation/by-category/{category}:
 *   get:
 *     summary: Get recommendations by category
 *     tags: [Recommendations]
 *     security: []
 *     parameters:
 *       - name: category
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Category ObjectId
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: excludeIds
 *         in: query
 *         schema: { type: string }
 *         description: Comma-separated product IDs to exclude
 *     responses:
 *       200:
 *         description: Category recommendations retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *
 *
 * /payment/service-charge:
 *   get:
 *     summary: Get payment service charge
 *     description: |
 *       Calculates the payment gateway fee and delivery fee for the current cart.
 *       Call this on the checkout screen before placing the order to show users the final total.
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: provider
 *         in: query
 *         schema:
 *           type: string
 *           enum: [paystack, opay, palmpay, cash_on_delivery]
 *           default: paystack
 *         description: Payment provider to calculate fees for
 *       - name: deliveryMethod
 *         in: query
 *         schema:
 *           type: string
 *           enum: [delivery, pickup]
 *           default: delivery
 *     responses:
 *       200:
 *         description: Service charge calculated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 provider:
 *                   type: string
 *                 subTotal:
 *                   type: number
 *                 serviceCharge:
 *                   type: number
 *                 deliveryFee:
 *                   type: number
 *                 totalAmount:
 *                   type: number
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /payment/methods:
 *   get:
 *     summary: Get enabled payment methods
 *     description: Returns payment methods currently enabled by the admin. Use this to populate checkout UI.
 *     tags: [Payment]
 *     security: []
 *     responses:
 *       200:
 *         description: Payment methods retrieved
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
 *                         paymentMethods:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/PaymentMethod'
 *
 * /payment/callback:
 *   get:
 *     summary: Payment gateway callback
 *     description: |
 *       Webhook-style redirect URL called by payment gateways after a transaction.
 *       Verifies the payment, updates order status and redirects the browser.
 *       **Not for direct client use**, handled automatically by the payment gateway.
 *     tags: [Payment]
 *     security: []
 *     parameters:
 *       - name: reference
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: provider
 *         in: query
 *         schema: { type: string, default: paystack }
 *       - name: platform
 *         in: query
 *         schema: { type: string, enum: [browser, mobile], default: browser }
 *     responses:
 *       302:
 *         description: Redirect to frontend success or error page
 *
 * /payment/verify:
 *   post:
 *     summary: Manually verify a payment
 *     description: Verifies a payment reference directly. Use this as a fallback if the callback was not received.
 *     tags: [Payment]
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
 *                 example: "PAY_ORD-260422-123456_1714000000000"
 *               provider:
 *                 type: string
 *                 enum: [paystack, opay, palmpay]
 *                 default: paystack
 *     responses:
 *       200:
 *         description: Payment verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Payment not verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /payment/webhook/{provider}:
 *   post:
 *     summary: Payment gateway webhook
 *     description: |
 *       Receives server-to-server webhook events from payment providers.
 *       Validates the signature header and processes `charge.success` events.
 *       **Not for direct client use**.
 *     tags: [Payment]
 *     security: []
 *     parameters:
 *       - name: provider
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [paystack, palmpay, opay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Provider-specific event payload
 *     responses:
 *       200:
 *         description: Webhook processed
 *       401:
 *         description: Invalid webhook signature
 */
export {};
