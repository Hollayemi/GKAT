import axios from 'axios';
import logger from '../utils/logger';

const apiKey = process.env.TERMII_API_KEY;
const senderId = process.env.TERMII_SENDER_ID;
const baseUrl =
    process.env.TERMII_BASE_URL || 'https://api.ng.termii.com/api';

interface SMSResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export const sendOTPViaSMS = async (
    phoneNumber: string,
    otp: string
): Promise<SMSResult> => {
    if (!apiKey || !senderId || !baseUrl) {
        logger.warn('Termii not configured. OTP not sent via SMS.');
        return {
            success: false,
            error: 'SMS service not configured'
        };
    }

    try {
        const response = await axios.post(`${baseUrl}/sms/send`, {
            api_key: apiKey,
            to: phoneNumber,
            from: senderId,
            sms: `Your Go-Kart verification code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
            type: 'plain',
            channel: 'generic'
        });

        logger.info(
            `OTP SMS sent to ${phoneNumber}. Response: ${JSON.stringify(
                response.data
            )}`
        );

        return {
            success: true,
            messageId:
                response.data?.message_id ||
                response.data?.messageId ||
                'termii-message'
        };
    } catch (error: any) {
        logger.error(`Failed to send OTP SMS to ${phoneNumber}:`, error);

        return {
            success: false,
            error:
                error.response?.data?.message ||
                error.message ||
                'Failed to send SMS'
        };
    }
};

export default { sendOTPViaSMS };