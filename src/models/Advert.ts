import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAdvert extends Document {
    title: string;
    description?: string;
    image: string;
    targetUrl?: string;
    isActive: boolean;
    position: string;
    clicks: number;
    startDate?: Date;
    endDate?: Date;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const AdvertSchema = new Schema<IAdvert>({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    image: {
        type: String,
        required: [true, 'Image is required']
    },
    targetUrl: {
        type: String,
        trim: true,
        validate: {
            validator: function(v: string) {
                if (!v) return true;
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Target URL must be a valid URL starting with http:// or https://'
        }
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    position: {
        type: String,
        default: 'top',
        enum: ['top', 'bottom', 'sidebar']
    },
    clicks: {
        type: Number,
        default: 0,
        min: 0
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
AdvertSchema.index({ isActive: 1, position: 1 });
AdvertSchema.index({ startDate: 1, endDate: 1 });
AdvertSchema.index({ createdAt: -1 });

// Virtual to check if advert is currently valid
AdvertSchema.virtual('isValid').get(function() {
    const now = new Date();
    
    if (!this.isActive) return false;
    
    if (this.startDate && now < this.startDate) return false;
    
    if (this.endDate && now > this.endDate) return false;
    
    return true;
});

// Pre-save validation
AdvertSchema.pre('save', function(next) {
    if (this.startDate && this.endDate && this.endDate <= this.startDate) {
        next(new Error('End date must be after start date'));
        return;
    }
    next();
});

export default mongoose.model<IAdvert>('Advert', AdvertSchema);