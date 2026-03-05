import twilio from 'twilio';
import logger from '../utils/logger';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

let client: twilio.Twilio | null = null;

const getClient = (): twilio.Twilio => {
    if (!client) {
        if (!accountSid || !authToken) {
            throw new Error('Twilio credentials are not configured');
        }
        client = twilio(accountSid, authToken);
    }
    return client;
};

interface SMSResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export const sendOTPViaSMS = async (
    phoneNumber: string,
    otp: string
): Promise<SMSResult> => {
    // In development, just log and skip real SMS
    if (process.env.NODE_ENV === 'development') {
        logger.info(`[DEV] OTP for ${phoneNumber}: ${otp}`);
        return { success: true, messageId: 'dev-mode' };
    }

    if (!accountSid || !authToken || !twilioPhone) {
        logger.warn('Twilio not configured. OTP not sent via SMS.');
        return { success: false, error: 'SMS service not configured' };
    }

    try {
        const twilioClient = getClient();

        const message = await twilioClient.messages.create({
            body: `Your Go-Kart verification code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
            from: twilioPhone,
            to: phoneNumber
        });

        logger.info(`OTP SMS sent to ${phoneNumber}. SID: ${message.sid}`);
        return { success: true, messageId: message.sid };
    } catch (error: any) {
        logger.error(`Failed to send OTP SMS to ${phoneNumber}:`, error);
        return {
            success: false,
            error: error.message || 'Failed to send SMS'
        };
    }
};

export default { sendOTPViaSMS };
