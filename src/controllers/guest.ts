import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';

function makeGuestId(clientToken?: string): string {
    if (clientToken && clientToken.length >= 8) {
        return 'guest_' + crypto
            .createHash('sha256')
            .update(clientToken)
            .digest('hex')
            .slice(0, 24);
    }
    return 'guest_' + crypto.randomBytes(16).toString('hex');
}

/**
 * POST /api/v1/auth/guest-session
 *
 * Body (all optional):
 *   guestId   – an existing guest ID (from a previous session stored client-side)
 *
 * Returns a JWT so the guest can use protected endpoints (cart, etc.).
 * If the guest ID does not exist yet it is created. If it does, the
 * existing record is returned — so calling this endpoint is idempotent.
 */
export const guestSession = asyncHandler(async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { guestId: incomingGuestId } = req.body;

    // Sanitise / derive the stable guest ID
    const guestId = incomingGuestId
        ? String(incomingGuestId).trim()
        : makeGuestId();

    if (!guestId.startsWith('guest_')) {
        return next(new AppError(
            'Invalid guestId format. Must start with "guest_".',
            400
        ));
    }

    try {
        await User.collection.dropIndex('phoneNumber_1');
        console.log('Index dropped successfully');
    } catch (err) {
        console.error('Index might not exist:', err);
    }

    // Find existing guest user or create a new one
    let user = await User.findOne({ guestId });

    if (!user) {
        user = await User.create({
            name: `Guest_${guestId.slice(-8)}`,
            guestId,
            isGuest: true,
            role: 'user',
            residentArea: 'Unknown',
            isPhoneVerified: false,
            isEmailVerified: false,
        });
    }

    // Issue a JWT (same shape as regular users)
    const token = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();
    await user.save({ validateBeforeSave: false });

    (res as AppResponse).data(
        {
            guestId: user.guestId,
            isGuest: true,
            token,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                isGuest: user.isGuest,
                guestId: user.guestId,
                role: user.role,
            }
        },
        'Guest session created',
        201
    );
});

/**
 * POST /api/v1/auth/guest-convert
 *
 * Converts a guest account to a full account once the user provides
 * their phone number and verifies via OTP.
 *
 * This endpoint is protected — the guest JWT must be in the
 * Authorization header.
 *
 * The flow:
 *   1. Guest calls POST /auth/send-otp  (existing endpoint) with phoneNumber
 *   2. Guest calls POST /auth/guest-convert with phoneNumber + otp
 *   3. Guest account is promoted; guestId is cleared
 */
export const convertGuest = asyncHandler(async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
        return next(new AppError('phoneNumber and otp are required', 400));
    }

    // The current user must be a guest
    const guestUser = await User.findById(req.user.id).select('+otp +otpExpiry');
    if (!guestUser) return next(new AppError('User not found', 404));
    if (!guestUser.isGuest) {
        return next(new AppError('Account is already a full account', 400));
    }

    // Verify OTP (OTP was sent to the phone via the existing /auth/send-otp endpoint)
    // We need to find by phone to get the OTP, then merge with the guest record
    const phoneUser = await User.findOne({ phoneNumber }).select('+otp +otpExpiry');

    if (phoneUser && phoneUser._id.toString() !== guestUser._id.toString()) {
        // A separate account already exists with this phone — merge cart then
        // point the guest to that account (outside scope of this PR; return error)
        return next(new AppError(
            'An account with this phone number already exists. Please log in instead.',
            409
        ));
    }

    // OTP was stored on the guest user itself (send-otp already does this)
    if (!guestUser.verifyOTP(otp)) {
        return next(new AppError('Invalid or expired OTP', 401));
    }

    // Promote the guest account
    guestUser.phoneNumber = phoneNumber;
    guestUser.isPhoneVerified = true;
    guestUser.isGuest = false;
    guestUser.guestId = undefined as any;
    guestUser.otp = undefined;
    guestUser.otpExpiry = undefined;
    await guestUser.save({ validateBeforeSave: false });

    const token = guestUser.getSignedJwtToken();
    const refreshToken = guestUser.getRefreshToken();
    await guestUser.save({ validateBeforeSave: false });

    (res as AppResponse).data(
        {
            user: {
                id: guestUser._id,
                name: guestUser.name,
                phoneNumber: guestUser.phoneNumber,
                role: guestUser.role,
                isGuest: false,
            },
            token,
            refreshToken,
        },
        'Guest account converted successfully'
    );
});