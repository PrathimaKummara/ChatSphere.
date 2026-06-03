// Import multer for handling multipart/form-data (file uploads)
const multer = require('multer');
// Import path to handle file extensions
const path = require('path');
// Import crypto to generate unique filenames
const crypto = require('crypto');

// Configure storage logic for avatars and media
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine the target folder based on the fieldname
    const isAvatar = file.fieldname === 'avatar';
    // Save to uploads/avatars/ or just uploads/
    const dest = isAvatar ? 'uploads/avatars/' : 'uploads/';
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename using a random hash + timestamp + original extension
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  }
});

// Create the multer instance with our storage config
const upload = multer({ 
  storage: storage,
  // Limit file size to 25MB for media and 5MB for avatars
  limits: {
    fileSize: 25 * 1024 * 1024 
  }
});

// Export the upload middleware for use in routes
module.exports = upload;
