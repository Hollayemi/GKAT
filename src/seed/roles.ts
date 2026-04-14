import mongoose from 'mongoose';
import Role from '../models/admin/Roles.models';
import Staff from '../models/admin/Staff.model';
import dotenv from 'dotenv';

dotenv.config();

const seedRoles = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(
                    process.env.NODE_ENV === 'production'
                        ? process.env.MONGODB_URI_PROD!
                        : process.env.MONGODB_URI!
                );
        console.log('MongoDB connected...');

        // Clear existing roles
        await Role.deleteMany({});
        console.log('Cleared existing roles');

        // Create roles
        const roles = [
            {
                "name": 'super_admin',
                "displayName": 'Super Admin',
                "permissions": [
                    'view_users',
                    'create_users',
                    'suspend_accounts',
                    'disable_accounts',
                    'access_reports',
                    'manage_promotions',
                    'coupon_management',
                    'view_coupon',
                    'assign_roles',
                    'view_financial_dashboard',
                    'system_settings',
                    'manage_roles'
                ]
            },
            {
                "name": 'warehouse_admin',
                "displayName": 'Warehouse Admin',
                "permissions": [
                    'view_users',
                    'create_users',
                    'suspend_accounts',
                    'access_reports',
                    'manage_promotions',
                    'assign_roles',
                    'view_financial_dashboard'
                ]
            },
            {
                "name": 'regional_manager',
                "displayName": 'Regional Manager',
                "permissions": [
                    'view_users',
                    'create_users',
                    'access_reports',
                    'manage_promotions',
                    'view_financial_dashboard'
                ]
            },
            {
                "name": 'inventory_manager',
                "displayName": 'Inventory Manager',
                "permissions": [
                    'view_users',
                    'access_reports'
                ]
            },
            {
                "name": 'customer_support',
                "displayName": 'Customer Support',
                "permissions": [
                    'view_users',
                    'access_reports'
                ]
            }
        ];

        const createdRoles = await Role.insertMany(roles);
        console.log('Roles created successfully:');
        createdRoles.forEach(role => {
            console.log(`- ${role.displayName} (${role.name})`);
        });

        // Create default Super Admin user if no users exist
        const userCount = await Staff.countDocuments();
        if (userCount === 0) {
            const superAdminRole = createdRoles.find(r => r.name === 'super_admin');
            
            if (superAdminRole) {
                const superAdmin = await Staff.create({
                    fullName: 'Super Administrator',
                    email: 'admin@gokart.ng',
                    password: 'Admin@123456',
                    role: superAdminRole._id,
                    status: 'active',
                    passwordResetRequired: true,
                    customPermissions: []
                });

                console.log('\nDefault Super Admin created:');
                console.log(`Email: ${superAdmin.email}`);
                console.log('Password: Admin@123456');
                console.log('\n IMPORTANT: Please change this password immediately after first login!');
            }
        }

        console.log('\nDatabase seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

// Run seed
seedRoles();