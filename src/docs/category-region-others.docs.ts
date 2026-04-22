/**
 * @swagger
 * tags:
 *   - name: Categories
 *     description: Product category management
 *   - name: Regions
 *     description: Delivery region management
 *   - name: Others
 *     description: Miscellaneous utility endpoints
 *
 *
 * /categories:
 *   get:
 *     summary: Get all categories (with optional search)
 *     description: |
 *       Returns all active categories ordered by `order` then name.
 *       Pass `?q=` to search categories by partial name instead of listing all.
 *     tags: [Categories]
 *     security: []
 *     parameters:
 *       - name: q
 *         in: query
 *         required: false
 *         description: Partial name search query (case-insensitive)
 *         schema:
 *           type: string
 *           example: "e"
 *     responses:
 *       200:
 *         description: Categories retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Category'
 *
 *   post:
 *     summary: Create a category (admin)
 *     description: Creates a new product category. Accepts an optional icon image file upload (multipart/form-data).
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Fruits & Vegetables"
 *               order:
 *                 type: integer
 *                 default: 0
 *                 example: 1
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               icon:
 *                 type: string
 *                 format: binary
 *                 description: Category icon image (JPG/PNG/WebP, max 5 MB)
 *     responses:
 *       201:
 *         description: Category created
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
 *                         category:
 *                           $ref: '#/components/schemas/Category'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /categories/with-count:
 *   get:
 *     summary: Get categories with product counts
 *     description: Returns all active categories along with the number of active products in each.
 *     tags: [Categories]
 *     security: []
 *     responses:
 *       200:
 *         description: Categories with counts
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
 *                         categories:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 $ref: '#/components/schemas/Category'
 *                               productCount:
 *                                 type: integer
 *
 * /categories/search:
 *   get:
 *     summary: Search categories by name
 *     description: Alternative explicit search endpoint. Also reachable via `GET /categories?q=`.
 *     tags: [Categories]
 *     security: []
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           example: "grain"
 *     responses:
 *       200:
 *         description: Search results
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
 *                         categories:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Category'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *
 * /categories/filter/{id}:
 *   get:
 *     summary: Get category with its products
 *     description: Returns a category and a paginated, filterable list of its products.
 *     tags: [Categories]
 *     security: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "6979118dca7599bcee7771f8"
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: sort
 *         in: query
 *         schema: { type: string, default: "-createdAt", example: "-createdAt" }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [active, inactive], default: active }
 *       - name: minPrice
 *         in: query
 *         schema: { type: number, example: 30000 }
 *       - name: maxPrice
 *         in: query
 *         schema: { type: number, example: 60000 }
 *     responses:
 *       200:
 *         description: Category with products
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
 *                         category:
 *                           $ref: '#/components/schemas/Category'
 *                         products:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Product'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /categories/{id}:
 *   get:
 *     summary: Get single category
 *     tags: [Categories]
 *     security: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category retrieved
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
 *                         category:
 *                           $ref: '#/components/schemas/Category'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   put:
 *     summary: Update category (admin)
 *     tags: [Categories]
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
 *               name:
 *                 type: string
 *               order:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *               icon:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Category updated
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
 *     summary: Delete category (admin)
 *     description: Cannot delete a category that has active products. Deactivate it instead.
 *     tags: [Categories]
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
 *         description: Category deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /categories/{id}/toggle-active:
 *   patch:
 *     summary: Toggle category active status (admin)
 *     tags: [Categories]
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
 *         description: Category activated or deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *
 * /regions:
 *   get:
 *     summary: Get all regions
 *     description: Returns all active delivery regions ordered by `order` field then name.
 *     tags: [Regions]
 *     security: []
 *     responses:
 *       200:
 *         description: Regions retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Region'
 *
 *   post:
 *     summary: Create a region
 *     description: Creates a new delivery region. The `coordinates` array must be `[longitude, latitude]` (GeoJSON order).
 *     tags: [Regions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, coordinates]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Surulere"
 *               coordinates:
 *                 type: array
 *                 items:
 *                   type: number
 *                 minItems: 2
 *                 maxItems: 2
 *                 description: "[longitude, latitude]"
 *                 example: [3.3515, 6.5041]
 *               order:
 *                 type: integer
 *                 default: 0
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Region created
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
 *                         region:
 *                           $ref: '#/components/schemas/Region'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *
 * /regions/search:
 *   get:
 *     summary: Search regions by name
 *     tags: [Regions]
 *     security: []
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           example: "Sur"
 *     responses:
 *       200:
 *         description: Search results
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
 *                         regions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Region'
 *
 * /regions/{id}:
 *   get:
 *     summary: Get single region
 *     tags: [Regions]
 *     security: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Region retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Region'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   put:
 *     summary: Update region (admin)
 *     tags: [Regions]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               coordinates:
 *                 type: array
 *                 items:
 *                   type: number
 *               order:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Region updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *   delete:
 *     summary: Delete region (admin)
 *     description: Cannot delete a region that has associated products.
 *     tags: [Regions]
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
 *         description: Region deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /regions/{id}/toggle-active:
 *   patch:
 *     summary: Toggle region active status (admin)
 *     tags: [Regions]
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
 *         description: Region activated or deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *
 * /nigeria-states:
 *   get:
 *     summary: Get Nigerian states and LGAs
 *     description: Returns all Nigerian states with their local government areas (LGAs). Useful for populating address forms.
 *     tags: [Others]
 *     security: []
 *     responses:
 *       200:
 *         description: Nigeria states data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         description: State document with arrays of LGA names keyed by state name
 */
export {};
