"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
const stream_1 = require("stream");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
class CloudinaryService {
    // Upload a single image
    async uploadImage(file, folder = 'go-kart') {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                folder: folder,
                resource_type: 'image',
                allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
                transformation: [
                    { width: 1000, height: 1000, crop: 'limit' },
                    { quality: 'auto:good' }
                ]
            }, (error, result) => {
                if (error) {
                    reject(error);
                }
                else if (result) {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id
                    });
                }
            });
            const bufferStream = new stream_1.Readable();
            bufferStream.push(file.buffer);
            bufferStream.push(null);
            bufferStream.pipe(uploadStream);
        });
    }
    // Upload multiple images
    async uploadMultipleImages(files, folder = 'go-kart') {
        const uploadPromises = files.map(file => this.uploadImage(file, folder));
        const results = await Promise.all(uploadPromises);
        return results.map(result => result.url);
    }
    // Delete an image by URL
    async deleteImage(imageUrl) {
        try {
            // Extract public_id from Cloudinary URL
            const publicId = this.extractPublicId(imageUrl);
            if (publicId) {
                await cloudinary_1.v2.uploader.destroy(publicId);
            }
        }
        catch (error) {
            console.error('Error deleting image from Cloudinary:', error);
            throw error;
        }
    }
    // Delete multiple images
    async deleteMultipleImages(imageUrls) {
        const deletePromises = imageUrls.map(url => this.deleteImage(url));
        await Promise.all(deletePromises);
    }
    // Extract public_id from Cloudinary URL
    extractPublicId(url) {
        try {
            const matches = url.match(/\/v\d+\/(.+)\./);
            return matches ? matches[1] : null;
        }
        catch (error) {
            return null;
        }
    }
    // Validate image file
    validateImageFile(file) {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return {
                valid: false,
                error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'
            };
        }
        if (file.size > maxSize) {
            return {
                valid: false,
                error: 'File size too large. Maximum size is 5MB.'
            };
        }
        return { valid: true };
    }
    // Validate multiple image files
    validateMultipleImageFiles(files) {
        for (const file of files) {
            const validation = this.validateImageFile(file);
            if (!validation.valid) {
                return validation;
            }
        }
        return { valid: true };
    }
}
// Multer configuration for memory storage
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
        }
    }
});
exports.default = new CloudinaryService();
//# sourceMappingURL=cloudinary.js.map