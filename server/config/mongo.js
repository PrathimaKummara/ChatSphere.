// Import the Mongoose library to connect to MongoDB
const mongoose = require('mongoose');

// Function to establish a connection to MongoDB with optimized performance settings
const connectMongo = async () => {
  try {
    // Attempt to connect to the database using the MONGO_URI from environment variables
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatsphere', {
      // PERFORMANCE TWEAK: Time to wait for a server to be selected before failing (Fix 4)
      serverSelectionTimeoutMS: 5000, 
      // PERFORMANCE TWEAK: Time to wait for a socket response before timing out (Fix 4)
      socketTimeoutMS: 45000,
      // PERFORMANCE TWEAK: Maximum number of connections to keep open in the pool (Fix 4)
      maxPoolSize: 10, 
          });
    
    // Log successful connection to the console
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // If connection fails, log the error message
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Terminate the process with an error code
    process.exit(1);
  }
};

// Export the connection function for use in index.js
module.exports = connectMongo;
