import mongoose from 'mongoose';
import PaymentMethod from '../models/PaymentMethod';
import dotenv from 'dotenv';

dotenv.config();

const defaultPaymentMethods = [
    {
        id: 'paystack',
        name: 'Paystack',
        description: 'Pay with Cards, Bank Transfer, USSD',
        logo: 'https://res.cloudinary.com/xmart/image/upload/v1771615922/paystack_qynpzs.png',
        enabled: true,
        sortOrder: 1
    },
    {
        id: 'palmpay',
        name: 'PalmPay',
        description: 'Pay with PalmPay Wallet',
        logo: '/images/palmpay-logo.png',
        enabled: true,
        sortOrder: 2
    },
    {
        id: 'opay',
        name: 'OPay',
        description: 'Pay with OPay Wallet, Cards, Bank Transfer',
        logo: 'https://res.cloudinary.com/xmart/image/upload/v1771615885/opay_g8vsac.png',
        enabled: true,
        sortOrder: 3
    },
    {
        id: 'cash_on_delivery',
        name: 'Cash on Delivery',
        description: 'Pay when your order is delivered',
        logo: 'https://res.cloudinary.com/xmart/image/upload/v1771615960/images_p8jpfi.png',
        enabled: true,
        sortOrder: 4
    }
];

export const seedPaymentMethods = async (): Promise<void> => {
    for (const method of defaultPaymentMethods) {
        await PaymentMethod.findOneAndUpdate(
            { id: method.id },
            { $setOnInsert: method },
            { upsert: true, new: true }
        );
    }
    console.log('✅ Payment methods seeded');
};

// Run standalone
if (require.main === module) {
    mongoose
        .connect(
            process.env.NODE_ENV === 'production'
                ? process.env.MONGODB_URI_PROD!
                : process.env.MONGODB_URI!
        )
        .then(async () => {
            await seedPaymentMethods();
            process.exit(0);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
