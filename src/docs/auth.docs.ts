/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication via OTP (phone-based), profile management and session control
 *
 * /auth/send-otp:
 *   post:
 *     summary: Send OTP to phone number
 *     description: |
 *       Creates a new user if the phone number is not registered, then sends a 6-digit OTP via SMS (Twilio).
 *       In **development** mode the OTP is also returned in the response body for convenience.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348147702684"
 *               residentArea:
 *                 type: string
 *                 example: "Lagos"
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *                         phoneNumber:
 *                           type: string
 *                           example: "+2348147702684"
 *                         message:
 *                           type: string
 *                           example: "OTP sent successfully"
 *                         otp:
 *                           type: string
 *                           description: Only present in development environment
 *                           example: "123456"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP and get access token
 *     description: Verifies the 6-digit OTP and returns a JWT access token + refresh token. Marks phone as verified on first use.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, otp]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348147702684"
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "662450"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /auth/login:
 *   post:
 *     summary: Login with phone number (triggers OTP)
 *     description: Looks up an existing user by phone number and sends an OTP. Use `/auth/verify-login-otp` to complete login.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348147702684"
 *     responses:
 *       200:
 *         description: OTP sent for login
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
 *                         phoneNumber:
 *                           type: string
 *                         requiresOTP:
 *                           type: boolean
 *                           example: true
 *                         otp:
 *                           type: string
 *                           description: Only present in development
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /auth/verify-login-otp:
 *   post:
 *     summary: Verify OTP for login
 *     description: Second step of login flow. Verifies the OTP sent by `/auth/login` and returns tokens.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, otp]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348147702684"
 *               otp:
 *                 type: string
 *                 example: "662450"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/resend-otp:
 *   post:
 *     summary: Resend OTP
 *     description: Generates a new OTP and sends it to the provided phone number.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348147702684"
 *     responses:
 *       200:
 *         description: OTP resent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Exchange a valid refresh token for a new access token and refresh token pair.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refreshed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/complete-profile:
 *   put:
 *     summary: Complete user profile
 *     description: Update the authenticated user's name, email and optional referral code after first login.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Oluwasusi Stephen"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "stephanyemmitty@gmail.com"
 *               referredBy:
 *                 type: string
 *                 description: Referral code of the person who referred this user
 *                 example: "ABCD1234"
 *     responses:
 *       200:
 *         description: Profile updated
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
 *                         user:
 *                           $ref: '#/components/schemas/UserPublic'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /auth/notifications:
 *   put:
 *     summary: Update push notification settings
 *     description: Enable or disable push notifications for the authenticated user.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Notification settings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /auth/biometrics:
 *   put:
 *     summary: Update biometric settings
 *     description: Enable or disable biometric authentication for the current user.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Biometric settings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Returns the full profile object of the currently authenticated user.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
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
 *                         user:
 *                           $ref: '#/components/schemas/UserPublic'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /auth/search-history:
 *   get:
 *     summary: Get search history & popular searches
 *     description: Returns the current user's personal search history and the platform's top-10 most-searched terms.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Search history retrieved
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
 *                         searchHistory:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["tomato", "indomie", "rice"]
 *                         popularSearches:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               query:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /auth/logout:
 *   post:
 *     summary: Logout
 *     description: Clears the refresh token and invalidates the session cookie.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export {};
