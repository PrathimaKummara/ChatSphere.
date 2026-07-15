// Import the multer library to process incoming multipart/form-data requests (file uploads).
const multer = require('multer');

// Import the path module to resolve absolute file paths on the server.
const path = require('path');

// Import the crypto module to generate secure, randomized strings for filenames.
const crypto = require('crypto');

// Import the Cloudinary storage class from the multer-storage-cloudinary library.
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Import our configured Cloudinary client instance.
const cloudinary = require('../config/cloudinary');

// --- 1. CLOUDINARY STORAGE CONFIGURATION (For Avatars/Profile Pics) ---
// This storage engine automatically uploads files directly to Cloudinary when received.
const cloudinaryStorage = new CloudinaryStorage({
  // Pass the configured Cloudinary v2 client instance.
  cloudinary: cloudinary,
  params: {
    // Save all profile pictures into a dedicated folder named 'avatars' in Cloudinary.
    folder: 'avatars',
    // Limit allowed upload formats to typical image formats for security and optimization.
    allowed_formats: ['jpg', 'png', 'jpeg'],
    // Request Cloudinary to auto-optimize and resize images to standard avatar dimensions.
    transformation: [{ width: 400, height: 400, crop: 'limit' }]
  }
});

// --- 2. LOCAL DISK STORAGE CONFIGURATION (For Chat Media/Attachments) ---
// We keep chat media attachments on the disk to support arbitrary file formats (PDFs, ZIPs, etc.).
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Resolve absolute path for the main uploads directory.
    const dest = path.join(__dirname, '../uploads');
    // Callback with error (null) and the destination folder path.
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Generate a unique suffix using crypto to prevent file collision errors.
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    // Extract the original file extension from the uploaded file.
    const ext = path.extname(file.originalname);
    // Callback with error (null) and the newly generated unique file name.
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  }
});

// --- 3. EXPORT CONFIGURABLE MULTER INSTANCES ---
// We export two distinct upload middleware instances for the different upload requirements.
module.exports = {
  // Use this middleware for avatar uploads (saves directly to Cloudinary).
  uploadAvatar: multer({
    storage: cloudinaryStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // Limit avatar files to 5MB
  }),
  // Use this middleware for generic chat message attachments (saves locally to disk).
  uploadMedia: multer({
    storage: diskStorage,
    limits: { fileSize: 25 * 1024 * 1024 } // Limit chat media files to 25MB
  })
};
