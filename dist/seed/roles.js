"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Roles_models_1 = __importDefault(require("../models/admin/Roles.models"));
const Staff_model_1 = __importDefault(require("../models/admin/Staff.model"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const seedRoles = async () => {
    try {
        // Connect to MongoDB
        await mongoose_1.default.connect(process.env.NODE_ENV === 'production'
            ? process.env.MONGODB_URI_PROD
            : process.env.MONGODB_URI);
        console.log('MongoDB connected...');
        // Clear existing roles
        await Roles_models_1.default.deleteMany({});
        console.log('Cleared existing roles');
        // Create roles
        const roles = [
            {
                name: 'super_admin',
                displayName: 'Super Admin',
                permissions: [
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
                ]
            },
            {
                name: 'warehouse_admin',
                displayName: 'Warehouse Admin',
                permissions: [
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
                name: 'regional_manager',
                displayName: 'Regional Manager',
                permissions: [
                    'view_users',
                    'create_users',
                    'access_reports',
                    'manage_promotions',
                    'view_financial_dashboard'
                ]
            },
            {
                name: 'inventory_manager',
                displayName: 'Inventory Manager',
                permissions: [
                    'view_users',
                    'access_reports'
                ]
            },
            {
                name: 'customer_support',
                displayName: 'Customer Support',
                permissions: [
                    'view_users',
                    'access_reports'
                ]
            }
        ];
        const createdRoles = await Roles_models_1.default.insertMany(roles);
        console.log('Roles created successfully:');
        createdRoles.forEach(role => {
            console.log(`- ${role.displayName} (${role.name})`);
        });
        // Create default Super Admin user if no users exist
        const userCount = await Staff_model_1.default.countDocuments();
        if (userCount === 0) {
            const superAdminRole = createdRoles.find(r => r.name === 'super_admin');
            if (superAdminRole) {
                const superAdmin = await Staff_model_1.default.create({
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
                console.log('\n⚠️  IMPORTANT: Please change this password immediately after first login!');
            }
        }
        console.log('\n✅ Database seeded successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};
// Run seed
seedRoles();
//# sourceMappingURL=roles.js.map