/**
 * @swagger
 * tags:
 *   - name: Rider - Auth
 *     description: Rider authentication and availability management
 *   - name: Rider - Profile
 *     description: Rider profile, stats and notifications
 *   - name: Rider - Orders
 *     description: Delivery order lifecycle for riders
 *   - name: Rider - Earnings
 *     description: Wallet, transactions, bank accounts and payouts
 *
 *
 * /rider/auth/set-password:
 *   post:
 *     summary: Set password from onboarding link
 *     description: |
 *       First-time password setup using the token sent to the rider's email during onboarding.
 *       Token expires after 24 hours. Once the password is set, the rider can log in via the
 *       standard `/auth/login` → `/auth/verify-login-otp` flow.
 *     tags: [Rider - Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password, confirmPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Setup token from onboarding email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "MySecurePass1!"
 *               confirmPassword:
 *                 type: string
 *                 example: "MySecurePass1!"
 *     responses:
 *       200:
 *         description: Password set successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Passwords do not match, too short, or token invalid/expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /rider/auth/me:
 *   get:
 *     summary: Get rider profile and wallet summary
 *     description: Returns the driver document (with populated user fields) plus a wallet summary (balance, totals).
 *     tags: [Rider - Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rider profile retrieved
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
 *                         driver:
 *                           $ref: '#/components/schemas/Driver'
 *                         wallet:
 *                           $ref: '#/components/schemas/WalletSummary'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /rider/auth/toggle-availability:
 *   patch:
 *     summary: Toggle online / offline status
 *     description: |
 *       Switches the rider between `online` and `offline`. Only verified, active riders
 *       can go online. Going online makes the rider visible to the dispatch system.
 *     tags: [Rider - Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability toggled
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
 *                         isOnline:
 *                           type: boolean
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Account not verified or not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *
 * /rider/profile/home:
 *   get:
 *     summary: Get home screen stats
 *     description: Returns driver info, delivery stats (total, cancelled, km), wallet balance and unread notification count in one call.
 *     tags: [Rider - Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Home stats retrieved
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
 *                         driver:
 *                           type: object
 *                           properties:
 *                             _id: { type: string }
 *                             name: { type: string }
 *                             avatar: { type: string, nullable: true }
 *                             rating: { type: number }
 *                             region: { type: string }
 *                             isOnline: { type: boolean }
 *                             status: { type: string }
 *                             verificationStatus: { type: string }
 *                         stats:
 *                           type: object
 *                           properties:
 *                             currentOrders: { type: integer }
 *                             totalDeliveries: { type: integer }
 *                             cancelledDeliveries: { type: integer }
 *                             totalKmTravelled: { type: number }
 *                         wallet:
 *                           type: object
 *                           properties:
 *                             balance: { type: number }
 *                             totalEarned: { type: number }
 *                         activeDelivery:
 *                           nullable: true
 *                           type: object
 *                         unreadNotifications:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/profile/stats:
 *   get:
 *     summary: Get rider performance stats
 *     description: Returns all-time delivery stats and this month's breakdown.
 *     tags: [Rider - Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance stats retrieved
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
 *                         allTime:
 *                           type: object
 *                           properties:
 *                             totalDeliveries: { type: integer }
 *                             completedDeliveries: { type: integer }
 *                             cancelledDeliveries: { type: integer }
 *                             completionRate: { type: number }
 *                             cancellationRate: { type: number }
 *                             totalKmTravelled: { type: number }
 *                             rating: { type: number }
 *                             reviewCount: { type: integer }
 *                         thisMonth:
 *                           type: object
 *                           properties:
 *                             delivered: { type: integer }
 *                             cancelled: { type: integer }
 *                             rejected: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/profile/notification-preferences:
 *   put:
 *     summary: Update notification preferences
 *     description: Toggle individual notification channels on or off for the rider.
 *     tags: [Rider - Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               push_notification: { type: boolean }
 *               in_app_notification: { type: boolean }
 *               email_notification: { type: boolean }
 *               notification_sound: { type: boolean }
 *               order_updates: { type: boolean }
 *               promotions: { type: boolean }
 *               system_updates: { type: boolean }
 *     responses:
 *       200:
 *         description: Preferences updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/profile/notifications:
 *   get:
 *     summary: Get rider notifications
 *     description: Returns paginated notifications for the rider, optionally filtered to unread only.
 *     tags: [Rider - Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: unreadOnly
 *         in: query
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Notifications retrieved
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
 *                         notifications:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Notification'
 *                         unreadCount:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/profile/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Rider - Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/profile/notifications/{id}/read:
 *   patch:
 *     summary: Mark single notification as read
 *     tags: [Rider - Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Notification ObjectId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *
 * /rider/orders/available:
 *   get:
 *     summary: Get available orders for dispatch
 *     description: Returns orders currently broadcasted in the rider's region that have not yet been accepted. Rider must be online.
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available orders retrieved
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
 *                             $ref: '#/components/schemas/DriverDelivery'
 *                         count:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Rider is offline or not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /rider/orders/active:
 *   get:
 *     summary: Get current active delivery
 *     description: Returns the rider's currently in-progress delivery, or `null` if none.
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active delivery retrieved (null if none)
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
 *                         delivery:
 *                           nullable: true
 *                           $ref: '#/components/schemas/DriverDelivery'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/orders/history:
 *   get:
 *     summary: Get delivery history
 *     description: Returns a paginated list of the rider's past deliveries.
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [all, delivered, cancelled, rejected]
 *           default: all
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Delivery history retrieved
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
 *                         deliveries:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/DriverDelivery'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/orders/{deliveryId}:
 *   get:
 *     summary: Get delivery details
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: deliveryId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Delivery details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /rider/orders/{deliveryId}/accept:
 *   post:
 *     summary: Accept a delivery order
 *     description: |
 *       Accepts a broadcasted order. The rider must be online and must not have an active delivery.
 *       The acceptance window expires after 20 seconds.
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: deliveryId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Already have an active delivery, order no longer available, or window expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/orders/{deliveryId}/reject:
 *   post:
 *     summary: Reject a delivery order
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: deliveryId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Too far from my location"
 *     responses:
 *       200:
 *         description: Order rejected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/orders/{deliveryId}/status:
 *   patch:
 *     summary: Update delivery status
 *     description: |
 *       Advances the delivery through its lifecycle.
 *       Valid transitions:
 *       - `accepted` → `arrived_at_store`
 *       - `arrived_at_store` → `picked_up`
 *       - `picked_up` → `in_transit`
 *       - `in_transit` → `arrived_at_customer`
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: deliveryId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [arrived_at_store, picked_up, in_transit, arrived_at_customer]
 *                 example: "picked_up"
 *               note:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   lat: { type: number }
 *                   lng: { type: number }
 *     responses:
 *       200:
 *         description: Status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Invalid transition
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/orders/{deliveryId}/confirm-delivery:
 *   post:
 *     summary: Confirm delivery with customer PIN
 *     description: |
 *       Completes the delivery by verifying the 4-digit PIN shared with the customer.
 *       On success, earnings are credited to the rider's wallet.
 *       Max 5 PIN attempts allowed.
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: deliveryId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pin]
 *             properties:
 *               pin:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 4
 *                 example: "4821"
 *     responses:
 *       200:
 *         description: Delivery confirmed, earnings credited
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
 *                         delivery:
 *                           $ref: '#/components/schemas/DriverDelivery'
 *                         earned:
 *                           type: number
 *       400:
 *         description: Incorrect PIN or too many attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/orders/{deliveryId}/cancel:
 *   post:
 *     summary: Cancel a delivery (before pickup only)
 *     description: Rider can cancel a delivery only in `accepted` or `arrived_at_store` status. A reason is required.
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: deliveryId
 *         in: path
 *         required: true
 *         schema: { type: string }
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
 *                 example: "Vehicle breakdown"
 *     responses:
 *       200:
 *         description: Delivery cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Cannot cancel at this stage
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/orders/{deliveryId}/rate-customer:
 *   post:
 *     summary: Rate the customer after delivery
 *     description: Allows the rider to leave a rating (1–5) and optional review for the customer after a successful delivery.
 *     tags: [Rider - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: deliveryId
 *         in: path
 *         required: true
 *         schema: { type: string }
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
 *               review:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Customer rated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *
 * /rider/earnings/wallet:
 *   get:
 *     summary: Get wallet summary
 *     description: Returns wallet balance, totals and earnings stats for today, this week and this month.
 *     tags: [Rider - Earnings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/WalletDetail'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/earnings/transactions:
 *   get:
 *     summary: Get transaction history
 *     description: Returns paginated wallet transactions, optionally filtered by type or category.
 *     tags: [Rider - Earnings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [credit, debit] }
 *       - name: category
 *         in: query
 *         schema:
 *           type: string
 *           enum: [delivery_earning, bonus, withdrawal, auto_payout, reversal]
 *     responses:
 *       200:
 *         description: Transactions retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/earnings/summary:
 *   get:
 *     summary: Get earnings summary
 *     description: Returns an aggregated earnings breakdown per day for the selected period.
 *     tags: [Rider - Earnings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Earnings summary retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/earnings/withdraw:
 *   post:
 *     summary: Withdraw earnings to bank account
 *     description: Initiates a withdrawal. Minimum withdrawal is ₦500. Funds arrive within 24–48 hours.
 *     tags: [Rider - Earnings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, bankAccountId]
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 500
 *                 example: 5000
 *               bankAccountId:
 *                 type: string
 *                 description: Bank account ObjectId from the wallet
 *     responses:
 *       200:
 *         description: Withdrawal initiated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Insufficient balance or amount below minimum
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/earnings/bank-accounts:
 *   post:
 *     summary: Add bank account
 *     description: Adds a Nigerian bank account for withdrawals. Maximum 5 accounts. Account number must be 10 digits.
 *     tags: [Rider - Earnings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankName, accountNumber, accountName]
 *             properties:
 *               bankName:
 *                 type: string
 *                 example: "Guaranty Trust Bank"
 *               bankCode:
 *                 type: string
 *                 example: "058"
 *               accountNumber:
 *                 type: string
 *                 pattern: "^\\d{10}$"
 *                 example: "0123456789"
 *               accountName:
 *                 type: string
 *                 example: "Stephen Oluwasusi"
 *     responses:
 *       201:
 *         description: Bank account added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/earnings/bank-accounts/{accountId}:
 *   delete:
 *     summary: Remove bank account
 *     tags: [Rider - Earnings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: accountId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Bank account removed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/earnings/bank-accounts/{accountId}/default:
 *   patch:
 *     summary: Set default bank account
 *     tags: [Rider - Earnings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: accountId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Default bank account updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /rider/earnings/auto-payout:
 *   get:
 *     summary: Get auto-payout settings
 *     tags: [Rider - Earnings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Auto-payout settings retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *   put:
 *     summary: Update auto-payout settings
 *     tags: [Rider - Earnings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, twice_monthly, monthly]
 *               minimumBalance:
 *                 type: number
 *                 minimum: 0
 *               bankAccountId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Auto-payout settings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export {};
