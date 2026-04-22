/**
 * @swagger
 * tags:
 *   - name: Cart
 *     description: Shopping cart management, items, coupons, live pricing with deal discounts
 *
 * /cart:
 *   get:
 *     summary: Get cart with live pricing
 *     description: |
 *       Returns the active cart for the authenticated user with fully-enriched items.
 *       All pricing is computed live at retrieval time:
 *       - Deal-of-the-day discounts are applied per item
 *       - Coupon discounts are stacked on top
 *       - Payment service charges are **not** included here, use `/payment/service-charge` to get those before checkout
 *       Also returns a list of eligible coupons the user can apply.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved
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
 *                         cart:
 *                           $ref: '#/components/schemas/CartDetail'
 *                         availableCoupons:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/CouponSummary'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *   post:
 *     summary: Add item to cart
 *     description: Adds a product (or variant) to the user's cart. If the item already exists, its quantity is incremented.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId:
 *                 type: string
 *                 example: "69c157071e74281ecfbfc6ca"
 *               variantId:
 *                 type: string
 *                 description: Optional, provide to add a specific product variant
 *                 example: "69c157071e74281ecfbfc6cb"
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *                 example: 1
 *     responses:
 *       200:
 *         description: Item added
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
 *                         cart:
 *                           $ref: '#/components/schemas/CartDetail'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Clear entire cart
 *     description: Removes all items and applied coupons from the user's active cart.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /cart/items/{productId}:
 *   put:
 *     summary: Update cart item quantity
 *     description: Sets the quantity of a specific item in the cart. Pass `quantity=0` or use the DELETE endpoint to remove.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: productId
 *         in: path
 *         required: true
 *         description: The product ID of the cart item to update
 *         schema:
 *           type: string
 *           example: "6924f6b281b1e6feb92992e0"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 4
 *               variantId:
 *                 type: string
 *                 description: Required when the item is a variant
 *                 example: "69c157071e74281ecfbfc6cb"
 *     responses:
 *       200:
 *         description: Cart item updated
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
 *                         cart:
 *                           $ref: '#/components/schemas/CartDetail'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Remove item from cart
 *     description: Removes a single item (or variant) from the cart.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: productId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "697d149f5c041eb16cd5d7b3"
 *       - name: variantId
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         description: Provide when removing a specific variant
 *     responses:
 *       200:
 *         description: Item removed
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
 *                         cart:
 *                           $ref: '#/components/schemas/CartDetail'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /cart/coupon:
 *   post:
 *     summary: Apply coupon to cart
 *     description: |
 *       Validates and applies a coupon code to the active cart.
 *       Multiple coupons can be stacked. Discounts are recalculated immediately.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [couponCode]
 *             properties:
 *               couponCode:
 *                 type: string
 *                 example: "WELCOME2026"
 *     responses:
 *       200:
 *         description: Coupon applied
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
 *                         cart:
 *                           $ref: '#/components/schemas/CartDetail'
 *       400:
 *         description: Invalid, expired, or already-applied coupon
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /cart/coupon/{code}:
 *   delete:
 *     summary: Remove coupon from cart
 *     description: Removes a previously applied coupon and recalculates cart totals.
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         description: The coupon code to remove (case-insensitive)
 *         schema:
 *           type: string
 *           example: "WELCOME2026"
 *     responses:
 *       200:
 *         description: Coupon removed
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
 *                         cart:
 *                           $ref: '#/components/schemas/CartDetail'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export {};
