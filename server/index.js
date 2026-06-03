// Load environment variables from the .env file into process.env
require('dotenv').config();

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

// Initialize Socket.IO with advanced configuration for performance (Fix 5)
const io = new Server(server, {
  cors: {
    // Allow the frontend running on port 3000 (or other specified origin) to connect
    origin: 'http://localhost:3000',
    // Allow standard HTTP methods
    methods: ['GET', 'POST']
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

// Verify the MySQL connection is healthy on server startup
db.getConnection()
  .then((connection) => {
    // Log success if we can get a connection from the pool
    console.log('MySQL Connected');
    // Release it back so others can use it
    connection.release(); 
  })
  .catch((err) => {
    // Log error if MySQL connection fails
    console.error('MySQL Connection Error:', err);
  });

// Use standard middleware to parse JSON request bodies
app.use(express.json());

// Enable CORS for all REST API endpoints
app.use(cors());

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

// Determine the port from environment variables or default to 5000
const PORT = process.env.PORT || 5000;

// Start listening for incoming connections
server.listen(PORT, () => {
  // Log the final server URL to the terminal
  console.log(`Server is running on port ${PORT}`);
});
