/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: In-app notification management for authenticated users
 *
 *
 * /notifications:
 *   get:
 *     summary: Get notifications
 *     description: |
 *       Returns the authenticated user's notifications grouped by time period
 *       (Today, Yesterday, This Week, Earlier).
 *       Supports pagination and optional filtering by type or unread status.
 *     tags: [Notifications]
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
 *         schema:
 *           type: string
 *           enum: [order, driver, promotion, system, message, payment, review]
 *         description: Filter by notification type
 *       - name: unreadOnly
 *         in: query
 *         schema: { type: boolean, default: false }
 *         description: Return only unread notifications
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
 *                           description: Notifications grouped by time period
 *                           items:
 *                             type: object
 *                             properties:
 *                               label:
 *                                 type: string
 *                                 example: "Today"
 *                               notifications:
 *                                 type: array
 *                                 items:
 *                                   $ref: '#/components/schemas/Notification'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *                         unreadCount:
 *                           type: integer
 *                           example: 5
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *
 * /notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     description: Returns the number of unread notifications for the authenticated user. Useful for badge counters.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved
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
 *                         count:
 *                           type: integer
 *                           example: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     description: Marks every unread notification for the authenticated user as read in a single call.
 *     tags: [Notifications]
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
 *
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     description: Marks one notification as read and updates its in-app delivery status.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Notification ObjectId
 *         schema:
 *           type: string
 *           example: "6924f6b281b1e6feb92992e0"
 *     responses:
 *       200:
 *         description: Notification marked as read
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
 *                         success:
 *                           type: boolean
 *                           example: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *
 * /notifications/{id}/click:
 *   post:
 *     summary: Track a notification click
 *     description: |
 *       Records that the user tapped/clicked the notification.
 *       Also marks the notification as read if it was previously unread.
 *       Call this when the user navigates from a notification to its target screen.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Notification ObjectId
 *         schema:
 *           type: string
 *           example: "6924f6b281b1e6feb92992e0"
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
 *                         success:
 *                           type: boolean
 *                           example: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *
 * /notifications/{id}:
 *   delete:
 *     summary: Delete (archive) a notification
 *     description: |
 *       Soft-deletes the notification by setting `archived: true` and `deletedAt`.
 *       The notification will no longer appear in the user's list.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Notification ObjectId
 *         schema:
 *           type: string
 *           example: "6924f6b281b1e6feb92992e0"
 *     responses:
 *       200:
 *         description: Notification deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export {};
