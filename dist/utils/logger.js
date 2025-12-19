"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
class Logger {
    constructor(level = 'info') {
        this.level = level;
        this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    }
    shouldLog(level) {
        return this.levels[level] <= this.levels[this.level];
    }
    log(level, message, ...args) {
        if (!this.shouldLog(level))
            return;
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        if (args.length > 0 && args[0] instanceof Error) {
            console.error(logMessage, args[0]);
        }
        else {
            console.log(logMessage, ...args);
        }
    }
    error(message, ...args) {
        this.log('error', message, ...args);
    }
    warn(message, ...args) {
        this.log('warn', message, ...args);
    }
    info(message, ...args) {
        this.log('info', message, ...args);
    }
    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
    setLevel(level) {
        this.level = level;
    }
    getLevel() {
        return this.level;
    }
}
exports.Logger = Logger;
const logger = new Logger(process.env.LOG_LEVEL || 'info');
exports.logger = logger;
exports.default = logger;
//# sourceMappingURL=logger.js.map