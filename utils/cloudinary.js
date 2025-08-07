import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

try {
  // Cloudinary configuration - using environment variables with hardcoded fallbacks
  const cloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dhaumphvl",
    api_key: process.env.CLOUDINARY_API_KEY || "223977999232774",
    api_secret: process.env.CLOUDINARY_API_SECRET || "A386eCIQlD5V_XxCERgSzUGwdb4",
    secure: true
  };

  // Configure Cloudinary
  cloudinary.config(cloudinaryConfig);

  console.log('Cloudinary configured with cloud name:', cloudinaryConfig.cloud_name);
} catch (error) {
  console.error('Failed to configure Cloudinary:', error.message);
  process.exit(1);
}

// Create storage engine for Multer
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    return {
      folder: "fabricadmin",
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    };
  },
});

// Upload image to Cloudinary
const uploadImage = async (file) => {
  try {
    console.log('Uploading file to Cloudinary:', file.originalname);
    
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "fabricadmin",
      use_filename: true,
      unique_filename: true,
      overwrite: true,
      resource_type: 'auto',
      chunk_size: 50 * 1024 * 1024 // 50MB chunks
    });
    
    console.log('Upload successful. Public ID:', result.public_id);
    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', {
      message: error.message,
      stack: error.stack,
      file: file?.originalname,
      size: file?.size
    });
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

// Test Cloudinary connection on startup
const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    console.log('Cloudinary connection test successful:', result);
    return true;
  } catch (error) {
    console.error('Cloudinary connection test failed:', error.message);
    return false;
  }
};

// Run connection test when this module is loaded
testCloudinaryConnection().catch(console.error);

export { storage, cloudinary, uploadImage };
