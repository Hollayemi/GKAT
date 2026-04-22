/**
 * @swagger
 * tags:
 *   - name: Products
 *     description: Product catalogue, deals, stock management and CSV import/export
 *
 * /product/deals-of-the-day:
 *   get:
 *     summary: Get deals of the day
 *     description: |
 *       Returns currently active deal products, items where `dealInfo.status` is `active`,
 *       the current time is within `startDate`–`endDate`, and the product is in stock.
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Deals retrieved
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
 *                         deals:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Product'
 *                         count:
 *                           type: integer
 *
 *   post:
 *     summary: Set deal of the day on a product (admin)
 *     description: Applies a deal (percentage discount with a date range) to a product.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, percentage, startDate, endDate]
 *             properties:
 *               productId:
 *                 type: string
 *                 example: "6977ff6f75376573f1919aa4"
 *               percentage:
 *                 type: number
 *                 description: Discount percentage (0–100)
 *                 example: 20
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-04-22T00:00:00Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-04-22T23:59:59Z"
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 default: active
 *     responses:
 *       200:
 *         description: Deal set
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /product:
 *   get:
 *     summary: Get products
 *     description: |
 *       Paginated product list with extensive filtering options. When a JWT token is present,
 *       search queries are automatically saved to the user's search history.
 *
 *       Pass `lat` + `lng` **or** `regionId` to scope results to a delivery region's stock.
 *       Pass `includeOverview=true` on the first page load to get dashboard stats in one call.
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - name: category
 *         in: query
 *         schema: { type: string }
 *         description: Category ObjectId
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, inactive, all, low-stock, out-of-stock]
 *           default: active
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Full-text search across name, description and tags
 *       - name: minPrice
 *         in: query
 *         schema: { type: number }
 *       - name: maxPrice
 *         in: query
 *         schema: { type: number }
 *       - name: tags
 *         in: query
 *         schema: { type: string }
 *         description: Comma-separated list of tags, e.g. `fresh,organic`
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: sort
 *         in: query
 *         schema: { type: string, default: "-createdAt" }
 *       - name: lat
 *         in: query
 *         schema: { type: number }
 *         description: User latitude for nearest-region resolution
 *       - name: lng
 *         in: query
 *         schema: { type: number }
 *         description: User longitude for nearest-region resolution
 *       - name: regionId
 *         in: query
 *         schema: { type: string }
 *         description: Explicit region ObjectId (takes precedence over lat/lng)
 *       - name: includeOverview
 *         in: query
 *         schema: { type: boolean, default: false }
 *         description: Include product overview stats in the response
 *     responses:
 *       200:
 *         description: Products retrieved
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
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *                         regionContext:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             regionId:
 *                               type: string
 *                             regionName:
 *                               type: string
 *                             distanceKm:
 *                               type: number
 *                         overview:
 *                           $ref: '#/components/schemas/ProductOverview'
 *                           nullable: true
 *
 *   post:
 *     summary: Create product with images (admin)
 *     description: |
 *       Creates a new product. Send as `multipart/form-data`.
 *       Fields `variants`, `tags`, and `regionDistribution` must be JSON-stringified strings.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [productName, sku, category, description, salesPrice, unitType, unitQuantity, stockQuantity, images]
 *             properties:
 *               productName:
 *                 type: string
 *                 example: "Indomie Instant Noodles"
 *               sku:
 *                 type: string
 *                 example: "GK-123456"
 *               category:
 *                 type: string
 *                 description: Category ObjectId
 *               brand:
 *                 type: string
 *               description:
 *                 type: string
 *               salesPrice:
 *                 type: number
 *                 example: 3500
 *               unitType:
 *                 type: string
 *                 enum: [single, pack, carton, kg, litre, box]
 *               unitQuantity:
 *                 type: number
 *                 example: 40
 *               stockQuantity:
 *                 type: integer
 *                 example: 200
 *               minimumStockAlert:
 *                 type: integer
 *                 default: 20
 *               tags:
 *                 type: string
 *                 description: JSON-stringified array, e.g. `["noodles","instant"]`
 *               variants:
 *                 type: string
 *                 description: JSON-stringified array of variant objects
 *               regionDistribution:
 *                 type: string
 *                 description: JSON-stringified array of regional distribution objects
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Up to 5 product images (JPG/PNG/WebP, max 5 MB each)
 *     responses:
 *       201:
 *         description: Product created
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
 *                         product:
 *                           $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Duplicate SKU
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   put:
 *     summary: Update product (admin)
 *     description: Updates an existing product. Send as `multipart/form-data`. The `_id` field is required in the body.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [_id]
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Product ObjectId to update
 *               productName:
 *                 type: string
 *               sku:
 *                 type: string
 *               salesPrice:
 *                 type: number
 *               stockQuantity:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [active, inactive, draft]
 *               existingImages:
 *                 type: string
 *                 description: JSON-stringified array of existing image URLs to keep
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: New images to upload and append
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /product/sku/{sku}:
 *   get:
 *     summary: Get product by SKU
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - name: sku
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "GK-123456"
 *     responses:
 *       200:
 *         description: Product retrieved
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
 *                         product:
 *                           $ref: '#/components/schemas/Product'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /product/overview/stats:
 *   get:
 *     summary: Get product overview stats (admin)
 *     description: Returns counts of total, in-stock, low-stock and out-of-stock products with month-over-month change percentages.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview stats
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ProductOverview'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /product/low-stock/products:
 *   get:
 *     summary: Get low-stock products (admin)
 *     description: Returns products where `stockQuantity <= minimumStockAlert`.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Low-stock products
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /product/bulk-update:
 *   patch:
 *     summary: Bulk update products (admin)
 *     description: Applies the same field updates to multiple products at once.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productIds, updates]
 *             properties:
 *               productIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               updates:
 *                 type: object
 *                 example: { "status": "inactive" }
 *     responses:
 *       200:
 *         description: Products updated
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
 *                         modifiedCount:
 *                           type: integer
 *                         matchedCount:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /product/import/template:
 *   get:
 *     summary: Download CSV import template (admin)
 *     description: Returns a CSV file with headers and one example row to guide bulk product imports.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV template file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /product/import:
 *   post:
 *     summary: Import products from CSV (admin)
 *     description: |
 *       Parses a CSV file and bulk-creates products. Validates each row individually,
 *       failed rows are reported without aborting the whole import.
 *       SKUs are auto-generated if left blank; categories are matched by name.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file (max 10 MB)
 *     responses:
 *       201:
 *         description: Import complete
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
 *                         imported:
 *                           type: integer
 *                         failed:
 *                           type: integer
 *                         created:
 *                           type: array
 *                           items:
 *                             type: object
 *                         errors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               row:
 *                                 type: integer
 *                               message:
 *                                 type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /product/all/export:
 *   get:
 *     summary: Export products to CSV (admin)
 *     description: Exports the current product catalogue (with optional filters) as a CSV file.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [active, inactive, all, draft] }
 *       - name: category
 *         in: query
 *         schema: { type: string }
 *       - name: minPrice
 *         in: query
 *         schema: { type: number }
 *       - name: maxPrice
 *         in: query
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: CSV export file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /product/{id}:
 *   get:
 *     summary: Get single product
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Product'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Delete product (admin)
 *     description: Deletes the product and its Cloudinary images.
 *     tags: [Products]
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
 *         description: Product deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /product/{id}/preview:
 *   get:
 *     summary: Get product preview with full analytics (admin)
 *     description: Returns the product with sales analytics, trends, pricing, regional inventory and stock history.
 *     tags: [Products]
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
 *         description: Product preview retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /product/{id}/stock:
 *   patch:
 *     summary: Update product stock (admin)
 *     description: Sets the stock quantity for a product or one of its variants.
 *     tags: [Products]
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
 *             properties:
 *               stockQuantity:
 *                 type: integer
 *                 minimum: 0
 *                 example: 150
 *               variantId:
 *                 type: string
 *                 description: Provide to update a variant's stock
 *               variantStock:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Stock updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /product/{id}/deals:
 *   delete:
 *     summary: Remove product from deals (admin)
 *     description: Removes the `dealInfo` from a product, effectively ending its deal status.
 *     tags: [Products]
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
 *         description: Product removed from deals
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
