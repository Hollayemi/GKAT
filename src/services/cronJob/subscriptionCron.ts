import cron from 'node-cron';
import UserSubscription from '../../models/UserSubscription';
import logger from '../../utils/logger';

export const initializeSubscriptionCronJobs = (): void => {
    // Every hour: mark expired subscriptions
    cron.schedule('0 * * * *', async () => {
        try {
            const result = await UserSubscription.updateMany(
                {
                    status: 'active',
                    endDate: { $lt: new Date() }
                },
                {
                    $set: { status: 'expired' }
                }
            );

            if (result.modifiedCount > 0) {
                logger.info(`[SubscriptionCron] Expired ${result.modifiedCount} subscription(s).`);
            }
        } catch (error) {
            logger.error('[SubscriptionCron] Error expiring subscriptions:', error);
        }
    });

    // Daily at 9 AM: send expiry reminder (7 days before)
    cron.schedule('0 9 * * *', async () => {
        try {
            const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const oneDayAhead = new Date(Date.now() + 24 * 60 * 60 * 1000);

            const expiringSoon = await UserSubscription.find({
                status: 'active',
                endDate: { $gte: oneDayAhead, $lte: sevenDaysFromNow }
            }).populate('userId', 'name email phoneNumber');

            for (const sub of expiringSoon) {
                const user = sub.userId as any;
                const daysLeft = sub.daysRemaining;

                logger.info(
                    `[SubscriptionCron] Reminder: User ${user?.name} (${user?.email}) ` +
                    `subscription "${sub.planSnapshot.name}" expires in ${daysLeft} day(s).`
                );

                // wire up email/push notification here
                // await sendEmail({ to: user.email, subject: 'Go Prime expiring soon', ... });
            }
        } catch (error) {
            logger.error('[SubscriptionCron] Error sending expiry reminders:', error);
        }
    });

    logger.info('✅ Subscription cron jobs initialized');
};