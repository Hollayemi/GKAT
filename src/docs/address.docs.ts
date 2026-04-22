/**
 * @swagger
 * tags:
 *   - name: Addresses
 *     description: Delivery address book management
 *
 * /addresses:
 *   get:
 *     summary: Get all addresses
 *     description: Returns all delivery addresses saved by the authenticated user, sorted with the default address first.
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addresses retrieved
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
 *                         addresses:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Address'
 *                         count:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *   post:
 *     summary: Add a new address
 *     description: |
 *       Creates a new delivery address for the user.
 *       If this is the user's **first** address it is automatically set as the default.
 *       Optionally include `coordinates` (lat/lng) to enable automatic region resolution at checkout.
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddressInput'
 *           example:
 *             label: "Home"
 *             landmark: "Pyakasa"
 *             localGovernment: "Abuja Municipal"
 *             phone: "08147702684"
 *             state: "FCT"
 *             street: "eGoshen Estate"
 *             address: "55, Giwa-Amu, Airport Road, Abuja"
 *             coordinates:
 *               lat: 9.0765
 *               lng: 7.3986
 *     responses:
 *       201:
 *         description: Address created
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
 *                         address:
 *                           $ref: '#/components/schemas/Address'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /addresses/default:
 *   get:
 *     summary: Get default address
 *     description: Returns the address currently flagged as the user's default delivery address.
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default address retrieved
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
 *                         address:
 *                           $ref: '#/components/schemas/Address'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: No default address set
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /addresses/{id}:
 *   get:
 *     summary: Get single address
 *     description: Returns one address belonging to the authenticated user.
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "69283f659a8dbf2e87fa390b"
 *     responses:
 *       200:
 *         description: Address retrieved
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
 *                         address:
 *                           $ref: '#/components/schemas/Address'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   put:
 *     summary: Update an address
 *     description: Updates any fields of an existing address. All fields are optional. only send what changes.
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "69283f249a8dbf2e87fa3900"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddressInput'
 *           example:
 *             label: "Home"
 *             phone: "08147702684"
 *             state: "Edo"
 *             address: "55, Giwa-Amu, Airport Road, Benin City"
 *     responses:
 *       200:
 *         description: Address updated
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
 *                         address:
 *                           $ref: '#/components/schemas/Address'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Delete an address
 *     description: |
 *       Removes the address. If the deleted address was the default, the next most-recently-created
 *       address is automatically promoted to default.
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "69283f249a8dbf2e87fa3900"
 *     responses:
 *       200:
 *         description: Address deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /addresses/{id}/default:
 *   patch:
 *     summary: Set address as default
 *     description: Marks the specified address as the user's default delivery address. Clears the default flag from all other addresses.
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "69283f659a8dbf2e87fa390b"
 *     responses:
 *       200:
 *         description: Default address set
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
 *                         address:
 *                           $ref: '#/components/schemas/Address'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export {};
