// Load environment variables from the .env file into process.env
require('dotenv').config();

// Force DNS resolution to prioritize IPv4 globally (avoids IPv6 connection errors on IPv4-only cloud hosts like Render)
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Import the Express framework for handling HTTP requests
const express = require('express');
// Import the built-in HTTP module to create a server
const http = require('http');
// Import Socket.IO Server to enable real-time communication
const { Server } = require('socket.io');
// Import CORS middleware to allow cross-origin requests from the frontend
const cors = require('cors');

// Import our custom API route modules
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const callRoutes = require('./routes/callRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');

// Import the real-time event handler for socket connections
const { socketHandler } = require('./socket/socketHandler');
// Import the MongoDB connection helper function
const connectMongo = require('./config/mongo');

// Import the MySQL database connection pool
const db = require('./config/db');

// Initialize the Express application
const app = express();

// Create an HTTP server using the Express app as the handler
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:3000',
  'https://chat-sphere-gray.vercel.app',
  'https://chat-sphere-zeta.vercel.app',
  'https://chat-sphere-lqg5uo60k-prathima-projects.vercel.app'
];

// Initialize Socket.IO with advanced configuration for performance (Fix 5)
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  // PERFORMANCE TWEAK: Time to wait for a pong response before assuming connection is dead (Fix 5)
  pingTimeout: 60000,
  // PERFORMANCE TWEAK: How often to send a heartbeat ping to keep connection alive (Fix 5)
  pingInterval: 25000,
  // PERFORMANCE TWEAK: Try WebSocket first for speed, fall back to polling if blocked (Fix 5)
  transports: ['websocket', 'polling'] 
});

// Attach io to the app so controllers can use it to emit events
app.set('io', io);

// Connect to MongoDB for storing chat message history
connectMongo();

// Keep MongoDB Atlas alive by pinging every 24 hours
const mongoose = require('mongoose');
setInterval(async () => {
  try {
    if (mongoose.connection && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      console.log('MongoDB keep-alive ping sent');
    }
  } catch (err) {
    console.log('Ping failed:', err.message);
  }
}, 1000 * 60 * 60 * 24); // every 24 hours

// Verify the MySQL connection is healthy on server startup
db.getConnection()
  .then(async (connection) => {
    // Log success if we can get a connection from the pool
    console.log('MySQL Connected');
    // Release it back so others can use it
    connection.release(); 

    // Run database schema initialization (creates tables if they do not exist)
    const initDatabase = require('./config/dbInit');
    try {
      await initDatabase();
    } catch (dbInitErr) {
      console.error('Failed to auto-initialize database tables:', dbInitErr);
    }
  })
  .catch((err) => {
    // Log error if MySQL connection fails
    console.error('MySQL Connection Error:', err);
  });

// Use standard middleware to parse JSON request bodies
app.use(express.json());

// Enable CORS for frontend development and production environments
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Serve the 'uploads' folder statically so the frontend can access media and avatars
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');

// Ensure upload directories exist on startup
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

// Mount the authentication routes
app.use('/api/auth', authRoutes);
// Mount the message history and request routes
app.use('/api/messages', messageRoutes);
// Mount the user profile and online status routes
app.use('/api/users', userRoutes);
app.use('/api/calls', callRoutes);
// Mount the room/group management routes
app.use('/api/rooms', roomRoutes); // Group rooms enabled

// Simple health check route to verify server is live
app.get('/', (req, res) => {
  res.send('ChatSphere Server is running!');
});

// Attach our real-time event listeners to the Socket.IO instance
socketHandler(io);

// Admin database cleanup route - clears all chats/conversations/messages, keeps users.
app.post('/api/admin/clear-chats', async (req, res) => {
  const { passcode } = req.body;
  if (passcode !== 'clear_chats_xyz_987') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  try {
    // 1. Clear MySQL Tables
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.query('DELETE FROM callhistory');
    await db.query('DELETE FROM RoomMembers');
    await db.query('DELETE FROM Rooms');
    await db.query('DELETE FROM DirectConversations');
    await db.query('DELETE FROM MessageRequests');
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('MySQL chat/conversation tables cleared.');

    // 2. Clear MongoDB Messages
    const Message = mongoose.model('Message');
    await Message.deleteMany({});
    console.log('MongoDB messages collection cleared.');

    res.status(200).json({ message: 'All chats and conversations cleared successfully!' });
  } catch (error) {
    console.error('Failed to clear database chats:', error);
    res.status(500).json({ message: 'Internal server error during database cleanup', error: error.message });
  }
});

// Determine the port from environment variables or default to 5000
const PORT = process.env.PORT || 5000;

// Start listening for incoming connections
server.listen(PORT, () => {
  // Log the final server URL to the terminal
  console.log(`Server is running on port ${PORT}`);
});
