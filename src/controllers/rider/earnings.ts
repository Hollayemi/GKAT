import { Request, Response, NextFunction } from 'express';
import Driver from '../../models/Driver';
import DriverWallet, { PayoutFrequency } from '../../models/DriverWallet';
import DriverDelivery from '../../models/DriverDelivery';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import mongoose from 'mongoose';


const getNextPayoutDate = (frequency: PayoutFrequency): Date => {
    const now = new Date();
    switch (frequency) {
        case 'daily': {
            const next = new Date(now);
            next.setDate(next.getDate() + 1);
            next.setHours(8, 0, 0, 0);
            return next;
        }
        case 'weekly': {
            const next = new Date(now);
            const day = next.getDay();
            const daysUntilFriday = (5 - day + 7) % 7 || 7;
            next.setDate(next.getDate() + daysUntilFriday);
            next.setHours(8, 0, 0, 0);
            return next;
        }
        case 'twice_monthly': {
            const next = new Date(now);
            if (now.getDate() < 15) {
                next.setDate(15);
            } else if (now.getDate() < 30) {
                next.setDate(30);
            } else {
                next.setMonth(next.getMonth() + 1, 15);
            }
            next.setHours(8, 0, 0, 0);
            return next;
        }
        case 'monthly': {
            const next = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            next.setHours(8, 0, 0, 0);
            return next;
        }
    }
};

function startOfISOWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const getEarningsOverview = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return next(new AppError('Not authenticated', 401));

        const driver = await Driver.findOne({ userId: req.user._id });
        if (!driver) return next(new AppError('Driver profile not found', 404));

        const wallet = await DriverWallet.findOne({ driverId: driver._id });
        if (!wallet) return next(new AppError('Wallet not found', 404));

        const period = ((req.query.period as string) || 'weekly').toLowerCase();
        const pageNum = parseInt((req.query.page as string) || '1');
        const limitNum = parseInt((req.query.limit as string) || '20');
        const now = new Date();

        const activeTimeResult = await DriverDelivery.aggregate([
            {
                $match: {
                    driverId: driver._id,
                    status: 'delivered',
                    acceptedAt: { $exists: true },
                    deliveredAt: { $exists: true },
                },
            },
            {
                $project: {
                    durationMs: { $subtract: ['$deliveredAt', '$acceptedAt'] },
                },
            },
            {
                $group: { _id: null, totalMs: { $sum: '$durationMs' } },
            },
        ]);

        const totalActiveMs = activeTimeResult[0]?.totalMs || 0;
        const activeHours = parseFloat((totalActiveMs / 3_600_000).toFixed(1));

        let chartData: Array<{ label: string; earned: number; deliveries: number }> = [];

        if (period === 'weekly') {
            const weekStart = startOfISOWeek(now);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            const rows = await DriverDelivery.aggregate([
                {
                    $match: {
                        driverId: driver._id,
                        status: 'delivered',
                        deliveredAt: { $gte: weekStart, $lt: weekEnd },
                    },
                },
                {
                    $group: {
                        _id: { $isoDayOfWeek: '$deliveredAt' },
                        earned: { $sum: '$fareBreakdown.totalEarned' },
                        deliveries: { $sum: 1 },
                    },
                },
            ]);

            const byDay: Record<number, { earned: number; deliveries: number }> = {};
            rows.forEach(r => { byDay[r._id] = { earned: r.earned, deliveries: r.deliveries }; });

            chartData = DAY_LABELS.map((label, i) => ({
                label,
                earned: byDay[i + 1]?.earned || 0,
                deliveries: byDay[i + 1]?.deliveries || 0,
            }));

        } else if (period === 'monthly') {

            const yearStart = new Date(now.getFullYear(), 0, 1);
            const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

            const rows = await DriverDelivery.aggregate([
                {
                    $match: {
                        driverId: driver._id,
                        status: 'delivered',
                        deliveredAt: { $gte: yearStart, $lt: yearEnd },
                    },
                },
                {
                    $group: {
                        _id: { $month: '$deliveredAt' }, // 1–12
                        earned: { $sum: '$fareBreakdown.totalEarned' },
                        deliveries: { $sum: 1 },
                    },
                },
            ]);

            const byMonth: Record<number, { earned: number; deliveries: number }> = {};
            rows.forEach(r => { byMonth[r._id] = { earned: r.earned, deliveries: r.deliveries }; });

            chartData = MONTH_LABELS.map((label, i) => ({
                label,
                earned: byMonth[i + 1]?.earned || 0,
                deliveries: byMonth[i + 1]?.deliveries || 0,
            }));

        } else {
            // yearly — last 5 calendar years
            const currentYear = now.getFullYear();
            const years = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);
            const rangeStart = new Date(years[0], 0, 1);
            const rangeEnd = new Date(currentYear + 1, 0, 1);

            const rows = await DriverDelivery.aggregate([
                {
                    $match: {
                        driverId: driver._id,
                        status: 'delivered',
                        deliveredAt: { $gte: rangeStart, $lt: rangeEnd },
                    },
                },
                {
                    $group: {
                        _id: { $year: '$deliveredAt' },
                        earned: { $sum: '$fareBreakdown.totalEarned' },
                        deliveries: { $sum: 1 },
                    },
                },
            ]);

            const byYear: Record<number, { earned: number; deliveries: number }> = {};
            rows.forEach(r => { byYear[r._id] = { earned: r.earned, deliveries: r.deliveries }; });

            chartData = years.map(yr => ({
                label: String(yr),
                earned: byYear[yr]?.earned || 0,
                deliveries: byYear[yr]?.deliveries || 0,
            }));
        }

        // Total displayed in the chart tooltip / header
        const chartTotal = chartData.reduce((sum, d) => sum + d.earned, 0);

        const allWithdrawals = wallet.transactions
            .filter(t => t.category === 'withdrawal' || t.category === 'auto_payout')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const totalWithdrawals = allWithdrawals.length;
        const skip = (pageNum - 1) * limitNum;
        const withdrawalHistory = allWithdrawals.slice(skip, skip + limitNum);

        (res as AppResponse).data(
            {
                wallet: {
                    balance: wallet.balance,
                    totalEarned: wallet.totalEarned,
                    totalWithdrawn: wallet.totalWithdrawn,
                },

                stats: {
                    activeHours,                              // "50 Hours — Active Time"
                    totalDeliveries: driver.completedDeliveries, // "250 — Total deliveries"
                },

                earningActivity: {
                    period,                                   // 'weekly' | 'monthly' | 'yearly'
                    total: chartTotal,                        // ₦62,350.12 — shown in tooltip
                    data: chartData,
                    // e.g. weekly:
                    // [
                    // ]
                },

                withdrawalHistory: {
                    transactions: withdrawalHistory,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total: totalWithdrawals,
                        pages: Math.ceil(totalWithdrawals / limitNum),
                    },
                },

                bankAccounts: wallet.bankAccounts,
                autoPayoutSettings: wallet.autoPayoutSettings,
            },
            'Earnings overview retrieved successfully'
        );
    }
);

export const getWallet = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const wallet = await DriverWallet.findOne({ driverId: driver._id });
    if (!wallet) return next(new AppError('Wallet not found', 404));

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayEarnings, weekEarnings, monthEarnings] = await Promise.all([
        DriverDelivery.aggregate([
            {
                $match: {
                    driverId: driver._id,
                    status: 'delivered',
                    deliveredAt: { $gte: startOfToday }
                }
            },
            { $group: { _id: null, total: { $sum: '$fareBreakdown.totalEarned' }, count: { $sum: 1 } } }
        ]),
        DriverDelivery.aggregate([
            {
                $match: {
                    driverId: driver._id,
                    status: 'delivered',
                    deliveredAt: { $gte: startOfWeek }
                }
            },
            { $group: { _id: null, total: { $sum: '$fareBreakdown.totalEarned' }, count: { $sum: 1 } } }
        ]),
        DriverDelivery.aggregate([
            {
                $match: {
                    driverId: driver._id,
                    status: 'delivered',
                    deliveredAt: { $gte: startOfMonth }
                }
            },
            { $group: { _id: null, total: { $sum: '$fareBreakdown.totalEarned' }, count: { $sum: 1 } } }
        ])
    ]);

    const deliveries = await DriverDelivery.find({
        driverId: driver._id,
    });

    let totalActiveTime = 0;
    let totalDistance = 0;
    let totalDeliveries = 0;
    let totalCompletedDeliveries = 0;

    deliveries.forEach((delivery) => {
        const history = delivery.statusHistory;
        if (!history || history.length < 2) return;
        const startTime = new Date(history[0].timestamp) as any;
        const endTime = new Date(history[history.length - 1].timestamp) as any;
        const diff = endTime - startTime;
        totalActiveTime += diff;
        totalDistance += delivery.distanceKm || 0;
        totalDeliveries += 1;
        if (delivery.status === 'delivered') totalCompletedDeliveries += 1;
    });

    const totalSeconds = Math.floor(totalActiveTime / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = (totalMinutes / 60).toFixed(2);

    (res as AppResponse).data(
        {
            balance: wallet.balance,
            totalEarned: wallet.totalEarned,
            totalWithdrawn: wallet.totalWithdrawn,
            totalDeliveries: wallet.totalDeliveries,
            bankAccounts: wallet.bankAccounts,
            autoPayoutSettings: wallet.autoPayoutSettings,
            totalDistance: parseFloat(totalDistance.toFixed(2)),
            totalCompletedDeliveries,
            activeTime: {
                totalSeconds,
                totalMinutes,
                totalHours,
            },
            stats: {
                today: {
                    earned: todayEarnings[0]?.total || 0,
                    deliveries: todayEarnings[0]?.count || 0
                },
                thisWeek: {
                    earned: weekEarnings[0]?.total || 0,
                    deliveries: weekEarnings[0]?.count || 0
                },
                thisMonth: {
                    earned: monthEarnings[0]?.total || 0,
                    deliveries: monthEarnings[0]?.count || 0
                }
            }
        },
        'Wallet retrieved successfully'
    );
});

export const getTransactions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const { page = 1, limit = 20, type, category } = req.query;

    const wallet = await DriverWallet.findOne({ driverId: driver._id });
    if (!wallet) return next(new AppError('Wallet not found', 404));

    let transactions = wallet.transactions as any[];

    if (type) transactions = transactions.filter(t => t.type === type);
    if (category) transactions = transactions.filter(t => t.category === category);

    transactions = transactions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = transactions.length;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const paginated = transactions.slice(skip, skip + parseInt(limit as string));

    (res as AppResponse).data(
        {
            transactions: paginated,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string))
            }
        },
        'Transactions retrieved successfully'
    );
});

export const withdrawEarnings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const { amount, bankAccountId } = req.body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return next(new AppError('A valid withdrawal amount is required', 400));
    }

    if (!bankAccountId) {
        return next(new AppError('Please select a bank account to withdraw to', 400));
    }

    const wallet = await DriverWallet.findOne({ driverId: driver._id });
    if (!wallet) return next(new AppError('Wallet not found', 404));

    const withdrawAmount = parseFloat(amount);

    if (wallet.balance < withdrawAmount) {
        return next(new AppError(
            `Insufficient balance. Available: ₦${wallet.balance.toLocaleString()}`,
            400
        ));
    }

    if (withdrawAmount < 500) {
        return next(new AppError('Minimum withdrawal amount is ₦500', 400));
    }

    const bankAccount = wallet.bankAccounts.find(
        b => b._id?.toString() === bankAccountId
    );

    if (!bankAccount) {
        return next(new AppError('Bank account not found', 404));
    }

    await wallet.debitWithdrawal(
        withdrawAmount,
        `Withdrawal to ${bankAccount.bankName} - ${bankAccount.accountNumber}`
    );

    (res as AppResponse).data(
        {
            amount: withdrawAmount,
            bankAccount: {
                bankName: bankAccount.bankName,
                accountNumber: bankAccount.accountNumber,
                accountName: bankAccount.accountName
            },
            newBalance: wallet.balance
        },
        'Withdrawal initiated. Funds will arrive within 24-48 hours.'
    );
});

export const addBankAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const { bankName, bankCode, accountNumber, accountName } = req.body;

    if (!bankName || !accountNumber || !accountName) {
        return next(new AppError('bankName, accountNumber and accountName are required', 400));
    }

    if (!/^\d{10}$/.test(accountNumber)) {
        return next(new AppError('Account number must be exactly 10 digits', 400));
    }

    const wallet = await DriverWallet.findOne({ driverId: driver._id });
    if (!wallet) return next(new AppError('Wallet not found', 404));

    if (wallet.bankAccounts.length >= 5) {
        return next(new AppError('Maximum of 5 bank accounts allowed', 400));
    }

    const duplicate = wallet.bankAccounts.find(b => b.accountNumber === accountNumber);
    if (duplicate) {
        return next(new AppError('This bank account has already been added', 409));
    }

    const isFirst = wallet.bankAccounts.length === 0;

    wallet.bankAccounts.push({
        bankName,
        bankCode,
        accountNumber,
        accountName,
        isDefault: isFirst,
        addedAt: new Date()
    });

    await wallet.save();

    (res as AppResponse).data(
        { bankAccounts: wallet.bankAccounts },
        'Bank account added successfully',
        201
    );
});

export const deleteBankAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const wallet = await DriverWallet.findOne({ driverId: driver._id });
    if (!wallet) return next(new AppError('Wallet not found', 404));

    const index = wallet.bankAccounts.findIndex(
        b => b._id?.toString() === req.params.accountId
    );

    if (index === -1) return next(new AppError('Bank account not found', 404));

    const wasDefault = wallet.bankAccounts[index].isDefault;
    wallet.bankAccounts.splice(index, 1);

    if (wasDefault && wallet.bankAccounts.length > 0) {
        wallet.bankAccounts[0].isDefault = true;
    }

    await wallet.save();

    (res as AppResponse).data(
        { bankAccounts: wallet.bankAccounts },
        'Bank account removed successfully'
    );
});

export const setDefaultBankAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const wallet = await DriverWallet.findOne({ driverId: driver._id });
    if (!wallet) return next(new AppError('Wallet not found', 404));

    const account = wallet.bankAccounts.find(
        b => b._id?.toString() === req.params.accountId
    );

    if (!account) return next(new AppError('Bank account not found', 404));

    wallet.bankAccounts.forEach(b => { b.isDefault = false; });
    account.isDefault = true;
    await wallet.save();

    (res as AppResponse).data(
        { bankAccounts: wallet.bankAccounts },
        'Default bank account updated'
    );
});

export const getAutoPayoutSettings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const wallet = await DriverWallet.findOne({ driverId: driver._id });
    if (!wallet) return next(new AppError('Wallet not found', 404));

    (res as AppResponse).data(
        { autoPayoutSettings: wallet.autoPayoutSettings, bankAccounts: wallet.bankAccounts },
        'Auto-payout settings retrieved'
    );
});

export const updateAutoPayoutSettings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const { enabled, frequency, minimumBalance, bankAccountId } = req.body;

    const validFrequencies: PayoutFrequency[] = ['daily', 'weekly', 'twice_monthly', 'monthly'];
    if (frequency && !validFrequencies.includes(frequency)) {
        return next(new AppError(`Frequency must be one of: ${validFrequencies.join(', ')}`, 400));
    }

    const wallet = await DriverWallet.findOne({ driverId: driver._id });
    if (!wallet) return next(new AppError('Wallet not found', 404));

    if (bankAccountId) {
        const accountExists = wallet.bankAccounts.some(
            b => b._id?.toString() === bankAccountId
        );
        if (!accountExists) return next(new AppError('Bank account not found', 404));
    }

    if (enabled !== undefined) wallet.autoPayoutSettings.enabled = enabled;
    if (frequency) {
        wallet.autoPayoutSettings.frequency = frequency;
        wallet.autoPayoutSettings.nextPayoutDate = getNextPayoutDate(frequency);
    }
    if (minimumBalance !== undefined) {
        if (minimumBalance < 0) return next(new AppError('Minimum balance cannot be negative', 400));
        wallet.autoPayoutSettings.minimumBalance = minimumBalance;
    }
    if (bankAccountId) {
        wallet.autoPayoutSettings.bankAccountId = new mongoose.Types.ObjectId(bankAccountId);
    }

    await wallet.save();

    (res as AppResponse).data(
        { autoPayoutSettings: wallet.autoPayoutSettings },
        'Auto-payout settings updated'
    );
});

export const getEarningsSummary = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const { period = 'month' } = req.query;

    const now = new Date();
    let startDate: Date;

    switch (period) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const summary = await DriverDelivery.aggregate([
        {
            $match: {
                driverId: driver._id,
                status: 'delivered',
                deliveredAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$deliveredAt' },
                    month: { $month: '$deliveredAt' },
                    day: { $dayOfMonth: '$deliveredAt' }
                },
                totalEarned: { $sum: '$fareBreakdown.totalEarned' },
                baseFare: { $sum: '$fareBreakdown.baseFare' },
                distanceBonus: { $sum: '$fareBreakdown.distanceBonus' },
                priorityFee: { $sum: '$fareBreakdown.priorityFee' },
                deliveries: { $sum: 1 },
                totalKm: { $sum: '$distanceKm' }
            }
        },
        { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } }
    ]);

    const totals = summary.reduce(
        (acc, day) => {
            acc.totalEarned += day.totalEarned;
            acc.baseFare += day.baseFare;
            acc.distanceBonus += day.distanceBonus;
            acc.priorityFee += day.priorityFee;
            acc.deliveries += day.deliveries;
            acc.totalKm += day.totalKm;
            return acc;
        },
        { totalEarned: 0, baseFare: 0, distanceBonus: 0, priorityFee: 0, deliveries: 0, totalKm: 0 }
    );

    (res as AppResponse).data(
        { period, totals, breakdown: summary },
        'Earnings summary retrieved'
    );
});
