type LogLevel = 'error' | 'warn' | 'info' | 'debug';
interface LoggerInterface {
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}
declare class Logger implements LoggerInterface {
    private level;
    private levels;
    constructor(level?: LogLevel);
    private shouldLog;
    private log;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
}
declare const logger: Logger;
export { Logger, logger };
export default logger;
//# sourceMappingURL=logger.d.ts.map