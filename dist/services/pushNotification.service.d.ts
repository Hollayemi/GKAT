export declare const initializeFirebase: () => void;
export declare const sendMulticastNotification: (tokens: string[], title: string, body: string, data?: {
    [key: string]: string;
}, image?: string) => Promise<{
    successCount: number;
    failureCount: number;
    failedTokens: string[];
}>;
export declare const sendBatchNotifications: (allTokens: string[], title: string, body: string, data?: {
    [key: string]: string;
}, image?: string) => Promise<{
    totalSuccess: number;
    totalFailure: number;
    allFailedTokens: string[];
}>;
export declare const sendToToken: (token: string, title: string, body: string, data?: {
    [key: string]: string;
}, image?: string) => Promise<boolean>;
export declare const cleanupInvalidTokens: (invalidTokens: string[]) => Promise<string[]>;
declare const _default: {
    initializeFirebase: () => void;
    sendMulticastNotification: (tokens: string[], title: string, body: string, data?: {
        [key: string]: string;
    }, image?: string) => Promise<{
        successCount: number;
        failureCount: number;
        failedTokens: string[];
    }>;
    sendBatchNotifications: (allTokens: string[], title: string, body: string, data?: {
        [key: string]: string;
    }, image?: string) => Promise<{
        totalSuccess: number;
        totalFailure: number;
        allFailedTokens: string[];
    }>;
    sendToToken: (token: string, title: string, body: string, data?: {
        [key: string]: string;
    }, image?: string) => Promise<boolean>;
    cleanupInvalidTokens: (invalidTokens: string[]) => Promise<string[]>;
};
export default _default;
//# sourceMappingURL=pushNotification.service.d.ts.map