"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = __importDefault(require("./config/database"));
const error_1 = require("./middleware/error");
dotenv_1.default.config();
(0, database_1.default)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, helmet_1.default)());
const limiter = (0, express_rate_limit_1.default)({
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// app.use('/api/', limiter);
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
app.use(error_1.jsonParseErrorHandler);
app.use(error_1.extendResponse);
if (process.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('combined'));
}
app.get('/health', (req, res) => {
    res.data({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        uptime: process.uptime()
    }, 'Server is healthy');
});
const auth_1 = __importDefault(require("./routes/auth"));
const products_1 = __importDefault(require("./routes/products"));
const cart_1 = __importDefault(require("./routes/cart"));
const order_1 = __importDefault(require("./routes/order"));
const address_1 = __importDefault(require("./routes/address"));
const payment_1 = __importDefault(require("./routes/payment"));
const coupon_1 = __importDefault(require("./routes/coupon"));
const category_1 = __importDefault(require("./routes/category"));
const region_1 = __importDefault(require("./routes/region"));
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/product', products_1.default);
app.use('/api/v1/cart', cart_1.default);
app.use('/api/v1/order', order_1.default);
app.use('/api/v1/addresses', address_1.default);
app.use('/api/v1/payment', payment_1.default);
app.use('/api/v1/admin/coupons', coupon_1.default);
app.use('/api/v1/categories', category_1.default);
app.use('/api/v1/regions', region_1.default);
app.use('*', error_1.handle404);
app.use(error_1.errorHandler);
const server = app.listen(PORT, () => {
    console.log(`
    GoKart Server Running
    Environment: ${process.env.NODE_ENV}
    Port: ${PORT}
    Time: ${new Date().toLocaleTimeString()}
  `);
});
process.on('unhandledRejection', (err) => {
    console.log('UNHANDLED REJECTION! Shutting down...');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});
process.on('uncaughtException', (err) => {
    console.log('UNCAUGHT EXCEPTION! Shutting down...');
    console.log(err.name, err.message);
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=server.js.map