import mongoose, { Document, Schema } from 'mongoose';

export interface IRole extends Document {
    name: string;
    displayName: string;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
}

const RoleSchema = new Schema<IRole>({
    name: {
        type: String,
        required: [true, 'Role name is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[a-z_]+$/, 'Role name can only contain lowercase letters and underscores']
    },
    displayName: {
        type: String,
        required: [true, 'Display name is required'],
        trim: true
    },
    permissions: [{
        type: String,
        required: true
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
RoleSchema.index({ name: 1 });

// Validate permissions before saving
RoleSchema.pre('save', function(next) {
    const validPermissions = [
        'view_users',
        'create_users',
        'suspend_accounts',
        'disable_accounts',
        'access_reports',
        'manage_promotions',
        'assign_roles',
        'view_financial_dashboard',
        'system_settings',
        'manage_roles'
    ];

    const invalidPermissions = this.permissions.filter(
        perm => !validPermissions.includes(perm)
    );

    if (invalidPermissions.length > 0) {
        return next(new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`));
    }

    next();
});

export default mongoose.model<IRole>('Role', RoleSchema);