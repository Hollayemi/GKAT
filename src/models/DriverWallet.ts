import mongoose, { Document, Schema, Types } from 'mongoose';

export type TransactionType = 'credit' | 'debit';
export type TransactionStatus = 'pending' | 'completed' | 'failed';
export type TransactionCategory =
    | 'delivery_earning'
    | 'bonus'
    | 'withdrawal'
    | 'auto_payout'
    | 'reversal';

export type PayoutFrequency = 'daily' | 'weekly' | 'twice_monthly' | 'monthly';

export interface IWalletTransaction {
    _id?: Types.ObjectId;
    type: TransactionType;
    category: TransactionCategory;
    amount: number;
    balanceAfter: number;
    description: string;
    referenceId?: Types.ObjectId;   // deliveryId or withdrawalId
    referenceType?: string;
    status: TransactionStatus;
    createdAt: Date;
}

export interface IBankAccount {
    _id?: Types.ObjectId;
    bankName: string;
    bankCode?: string;
    accountNumber: string;
    accountName: string;
    isDefault: boolean;
    addedAt: Date;
}

export interface IAutoPayoutSettings {
    enabled: boolean;
    frequency: PayoutFrequency;
    minimumBalance: number;         // Min wallet balance before auto-payout triggers
    bankAccountId?: Types.ObjectId;
    nextPayoutDate?: Date;
    lastPayoutDate?: Date;
}

export interface IDriverWallet extends Document {
    driverId: Types.ObjectId;
    userId: Types.ObjectId;

    balance: number;
    totalEarned: number;
    totalWithdrawn: number;
    totalDeliveries: number;

    transactions: IWalletTransaction[];
    bankAccounts: IBankAccount[];
    autoPayoutSettings: IAutoPayoutSettings;

    createdAt: Date;
    updatedAt: Date;

    creditEarning(amount: number, description: string, referenceId?: Types.ObjectId): Promise<IDriverWallet>;
    debitWithdrawal(amount: number, description: string, referenceId?: Types.ObjectId): Promise<IDriverWallet>;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>({
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    category: {
        type: String,
        enum: ['delivery_earning', 'bonus', 'withdrawal', 'auto_payout', 'reversal'],
        required: true
    },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    referenceId: { type: Schema.Types.ObjectId },
    referenceType: { type: String, trim: true },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const BankAccountSchema = new Schema<IBankAccount>({
    bankName: { type: String, required: true, trim: true },
    bankCode: { type: String, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
    addedAt: { type: Date, default: Date.now }
}, { _id: true });

const AutoPayoutSettingsSchema = new Schema<IAutoPayoutSettings>({
    enabled: { type: Boolean, default: false },
    frequency: {
        type: String,
        enum: ['daily', 'weekly', 'twice_monthly', 'monthly'],
        default: 'weekly'
    },
    minimumBalance: { type: Number, default: 2000, min: 0 },
    bankAccountId: { type: Schema.Types.ObjectId },
    nextPayoutDate: { type: Date },
    lastPayoutDate: { type: Date }
}, { _id: false });

const DriverWalletSchema = new Schema<IDriverWallet>({
    driverId: {
        type: Schema.Types.ObjectId,
        ref: 'Driver',
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    balance: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    totalDeliveries: { type: Number, default: 0, min: 0 },
    transactions: [WalletTransactionSchema],
    bankAccounts: [BankAccountSchema],
    autoPayoutSettings: { type: AutoPayoutSettingsSchema, default: () => ({}) }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

DriverWalletSchema.index({ driverId: 1 });
DriverWalletSchema.index({ 'transactions.createdAt': -1 });

DriverWalletSchema.methods.creditEarning = async function (
    amount: number,
    description: string,
    referenceId?: Types.ObjectId
): Promise<IDriverWallet> {
    this.balance += amount;
    this.totalEarned += amount;
    this.totalDeliveries += 1;
    this.transactions.push({
        type: 'credit',
        category: 'delivery_earning',
        amount,
        balanceAfter: this.balance,
        description,
        referenceId,
        referenceType: 'DriverDelivery',
        status: 'completed',
        createdAt: new Date()
    });
    return this.save();
};

DriverWalletSchema.methods.debitWithdrawal = async function (
    amount: number,
    description: string,
    referenceId?: Types.ObjectId
): Promise<IDriverWallet> {
    if (this.balance < amount) {
        throw new Error('Insufficient wallet balance');
    }
    this.balance -= amount;
    this.totalWithdrawn += amount;
    this.transactions.push({
        type: 'debit',
        category: 'withdrawal',
        amount,
        balanceAfter: this.balance,
        description,
        referenceId,
        referenceType: 'Withdrawal',
        status: 'completed',
        createdAt: new Date()
    });
    return this.save();
};

export default mongoose.model<IDriverWallet>('DriverWallet', DriverWalletSchema);