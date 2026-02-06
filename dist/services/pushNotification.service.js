"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupInvalidTokens = exports.sendToToken = exports.sendBatchNotifications = exports.sendMulticastNotification = exports.initializeFirebase = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
// Initialize Firebase Admin SDK
let firebaseInitialized = false;
const initializeFirebase = () => {
    if (firebaseInitialized)
        return;
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount)
        });
        firebaseInitialized = true;
        console.log('✅ Firebase Admin SDK initialized successfully');
    }
    catch (error) {
        console.error('❌ Failed to initialize Firebase Admin SDK:', error);
        throw error;
    }
};
exports.initializeFirebase = initializeFirebase;
// Send notification to multiple devices
const sendMulticastNotification = async (tokens, title, body, data, image) => {
    if (!firebaseInitialized) {
        (0, exports.initializeFirebase)();
    }
    if (tokens.length === 0) {
        return {
            successCount: 0,
            failureCount: 0,
            failedTokens: []
        };
    }
    try {
        const messages = tokens.map(token => ({
            notification: {
                title,
                body,
                ...(image && { imageUrl: image })
            },
            data: data || {},
            token
        }));
        const results = await Promise.allSettled(messages.map(msg => firebase_admin_1.default.messaging().send(msg)));
        const failedTokens = [];
        let successCount = 0;
        let failureCount = 0;
        results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
                successCount++;
            }
            else {
                failureCount++;
                failedTokens.push(tokens[idx]);
            }
        });
        return {
            successCount,
            failureCount,
            failedTokens
        };
    }
    catch (error) {
        console.error('Error sending multicast notification:', error);
        throw error;
    }
};
exports.sendMulticastNotification = sendMulticastNotification;
// Send notification in batches (FCM limit is 500 tokens per request)
const sendBatchNotifications = async (allTokens, title, body, data, image) => {
    const BATCH_SIZE = 500;
    const batches = [];
    // Split tokens into batches
    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
        batches.push(allTokens.slice(i, i + BATCH_SIZE));
    }
    let totalSuccess = 0;
    let totalFailure = 0;
    const allFailedTokens = [];
    // Send each batch
    for (const batch of batches) {
        try {
            const result = await (0, exports.sendMulticastNotification)(batch, title, body, data, image);
            totalSuccess += result.successCount;
            totalFailure += result.failureCount;
            allFailedTokens.push(...result.failedTokens);
        }
        catch (error) {
            console.error('Batch send failed:', error);
            totalFailure += batch.length;
            allFailedTokens.push(...batch);
        }
    }
    return {
        totalSuccess,
        totalFailure,
        allFailedTokens
    };
};
exports.sendBatchNotifications = sendBatchNotifications;
// Send to single token (for testing)
const sendToToken = async (token, title, body, data, image) => {
    if (!firebaseInitialized) {
        (0, exports.initializeFirebase)();
    }
    try {
        const message = {
            notification: {
                title,
                body,
                ...(image && { imageUrl: image })
            },
            data: data || {},
            token
        };
        await firebase_admin_1.default.messaging().send(message);
        return true;
    }
    catch (error) {
        console.error('Error sending notification to token:', error);
        return false;
    }
};
exports.sendToToken = sendToToken;
// Clean up invalid tokens from database
const cleanupInvalidTokens = async (invalidTokens) => {
    // This will be implemented in the User/Driver models
    // to remove invalid FCM tokens
    console.log(`Cleaning up ${invalidTokens.length} invalid tokens`);
    return invalidTokens;
};
exports.cleanupInvalidTokens = cleanupInvalidTokens;
exports.default = {
    initializeFirebase: exports.initializeFirebase,
    sendMulticastNotification: exports.sendMulticastNotification,
    sendBatchNotifications: exports.sendBatchNotifications,
    sendToToken: exports.sendToToken,
    cleanupInvalidTokens: exports.cleanupInvalidTokens
};
//# sourceMappingURL=pushNotification.service.js.map