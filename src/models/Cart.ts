import mongoose, { Document, Model, Schema, Types } from 'mongoose';

// Interface for Cart Item
export interface ICartItem {
    productId: Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    totalPrice: number;
}

// Interface for Cart Document
export interface ICart extends Document {
    userId: Types.ObjectId;
    items: ICartItem[];
    totalAmount: number;
    totalItems: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;

    // Instance methods
    addItem(productData: {
        id: Types.ObjectId;
        name: string;
        price: number;
        quantity?: number;
        image?: string;
    }): Promise<ICart>;

    removeItem(productId: Types.ObjectId): Promise<ICart>;

    updateItemQuantity(productId: Types.ObjectId, quantity: number): Promise<ICart>;

    clearCart(): Promise<ICart>;
}

// Interface for Cart Model with static methods
interface ICartModel extends Model<ICart> {
    findOrCreateCart(userId: Types.ObjectId): Promise<ICart>;
}

// Cart Item Schema
const cartItemSchema = new Schema<ICartItem>({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    image: {
        type: String,
        default: ''
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    _id: false // Disable _id for subdocuments
});

// Cart Schema
const cartSchema = new Schema<ICart, ICartModel>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [cartItemSchema],
    totalAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    totalItems: {
        type: Number,
        default: 0,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Pre-save middleware to calculate totals
cartSchema.pre('save', function (next) {
    // Calculate total amount and total items
    this.totalAmount = this.items.reduce((total, item) => total + item.totalPrice, 0);
    this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);

    // Update totalPrice for each item
    this.items.forEach(item => {
        item.totalPrice = item.price * item.quantity;
    });

    next();
});

// Instance method to add item to cart
cartSchema.methods.addItem = function (productData: {
    id: Types.ObjectId;
    name: string;
    price: number;
    quantity?: number;
    image?: string;
}): Promise<ICart> {
    const existingItemIndex = this.items.findIndex(
        (item: ICartItem) => item.productId.toString() === productData.id.toString()
    );

    if (existingItemIndex >= 0) {
        this.items[existingItemIndex].quantity += productData.quantity || 1;
        this.items[existingItemIndex].totalPrice =
            this.items[existingItemIndex].price * this.items[existingItemIndex].quantity;
    } else {
        this.items.push({
            productId: productData.id,
            name: productData.name,
            price: productData.price,
            quantity: productData.quantity || 1,
            image: productData.image || '',
            totalPrice: productData.price * (productData.quantity || 1)
        });
    }

    return this.save();
};

cartSchema.methods.removeItem = function (productId: Types.ObjectId): Promise<ICart> {
    this.items = this.items.filter((item: ICartItem) =>
        item.productId.toString() !== productId.toString()
    );
    return this.save();
};

cartSchema.methods.updateItemQuantity = function (
    productId: Types.ObjectId,
    quantity: number
): Promise<ICart> {
    const item = this.items.find((item: ICartItem) =>
        item.productId.toString() === productId.toString()
    );

    if (item) {
        if (quantity <= 0) {
            return this.removeItem(productId);
        }
        item.quantity = quantity;
        item.totalPrice = item.price * quantity;
        return this.save();
    }
    throw new Error('Item not found in cart');
};

cartSchema.methods.clearCart = function (): Promise<ICart> {
    this.items = [];
    this.totalAmount = 0;
    this.totalItems = 0;
    return this.save();
};

cartSchema.statics.findOrCreateCart = async function (userId: Types.ObjectId): Promise<ICart> {
    let cart = await this.findOne({ userId, isActive: true });
    if (!cart) {
        cart = new this({ userId });
        await cart.save();
    }
    return cart;
};

const Cart: ICartModel = mongoose.model<ICart, ICartModel>('Cart', cartSchema);

export default Cart;