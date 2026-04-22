import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Go-Kart API',
            version: '1.0.0',
            description: `
                ## Go-Kart Grocery Delivery Platform, API Reference

                A full-stack grocery e-commerce and delivery system built with Node.js / TypeScript / MongoDB.

                ### Authentication
                Most endpoints require a Bearer JWT. Obtain one by completing the OTP login flow:
                1. \`POST /auth/send-otp\` or \`POST /auth/login\`
                2. \`POST /auth/verify-otp\` or \`POST /auth/verify-login-otp\`

                The response includes an \`accessToken\` (7 days) and a \`refreshToken\` (30 days).
                Use \`POST /auth/refresh-token\` to rotate tokens without re-authenticating.

                ### Base URL
                - **Development** \`http://localhost:5000/api/v1\`
                - **Production** \`https://gokart-foht.onrender.com/api/v1\`

                ### Response format
                All responses follow a consistent envelope:
                \`\`\`json
                {
                "success": true,
                "type": "success",
                "message": "...",
                "data": { ... },
                "timestamp": "2026-04-22T12:00:00.000Z"
                }
                \`\`\`
                Error responses set \`success: false\` and add an \`error\` field in development mode.
`,
            contact: {
                name: 'Stephen Oluwasusi',
                email: 'support@gokart.ng',
            },
            license: {
                name: 'MIT',
            },
        },
        servers: [
            {
                url: 'http://localhost:5000/api/v1',
                description: 'Development server',
            },
            {
                url: 'https://gokart-foht.onrender.com/api/v1',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{ bearerAuth: [] }],
        // Group ordering for Swagger UI sidebar
        tags: [
            { name: 'Authentication', description: 'OTP-based auth, profile and session management' },
            { name: 'Cart', description: 'Shopping cart, items, coupons, live pricing' },
            { name: 'Orders', description: 'Order lifecycle, create, track, cancel, re-pay' },
            { name: 'Addresses', description: 'Delivery address book' },
            { name: 'Products', description: 'Product catalogue, deals, stock and CSV operations' },
            { name: 'Categories', description: 'Product category management' },
            { name: 'Regions', description: 'Delivery region management' },
            { name: 'Adverts', description: 'Banner and promotional advertisement management' },
            { name: 'Recommendations', description: 'Personalised and trending product recommendations' },
            { name: 'Payment', description: 'Payment gateway callbacks, webhooks and service charges' },
            { name: 'Rider - Auth', description: 'Rider authentication and availability' },
            { name: 'Rider - Profile', description: 'Rider profile, stats and notifications' },
            { name: 'Rider - Orders', description: 'Delivery order lifecycle for riders' },
            { name: 'Rider - Earnings', description: 'Wallet, transactions, bank accounts and payouts' },
            { name: 'Others', description: 'Utility endpoints (Nigeria states, etc.)' },
        ],
    },
    apis: [
        './src/routes/*.ts',
        './src/routes/**/*.ts',
        './src/docs/*.ts',
    ],
};

export const swaggerSpec = swaggerJsdoc(options);
