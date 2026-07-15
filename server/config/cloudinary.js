// Import the Cloudinary library (version 2) which allows us to upload files to their cloud storage.
const cloudinary = require('cloudinary').v2;

// Configure the Cloudinary instance with our account credentials.
// These credentials should be set in our environment variables (.env file) on Render/local.
cloudinary.config({
  // The unique identifier/name of your Cloudinary account.
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  
  // The API key used to authenticate request signatures.
  api_key: process.env.CLOUDINARY_API_KEY,
  
  // The API secret key (never expose this to the frontend) used to authorize secure actions.
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Export the configured Cloudinary instance so other files (like upload middleware) can use it.
module.exports = cloudinary;
