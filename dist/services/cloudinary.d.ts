import multer from 'multer';
interface UploadResult {
    url: string;
    publicId: string;
}
declare class CloudinaryService {
    uploadImage(file: Express.Multer.File, folder?: string): Promise<UploadResult>;
    uploadMultipleImages(files: Express.Multer.File[], folder?: string): Promise<string[]>;
    deleteImage(imageUrl: string): Promise<void>;
    deleteMultipleImages(imageUrls: string[]): Promise<void>;
    private extractPublicId;
    validateImageFile(file: Express.Multer.File): {
        valid: boolean;
        error?: string;
    };
    validateMultipleImageFiles(files: Express.Multer.File[]): {
        valid: boolean;
        error?: string;
    };
}
export declare const upload: multer.Multer;
declare const _default: CloudinaryService;
export default _default;
//# sourceMappingURL=cloudinary.d.ts.map