// Import the mysql2 package
const mysql = require('mysql2');

// We use a connection pool instead of a single connection because:
// 1. It manages multiple connections automatically.
// 2. It reuses existing connections, which is faster and saves server resources.
// 3. It handles dropped connections more gracefully in a real-time app.
const pool = mysql.createPool({
  host: process.env.DB_HOST,         // Database host (e.g., localhost)
  user: process.env.DB_USER,         // Database username (e.g., root)
  password: process.env.DB_PASSWORD, // Database password
  database: process.env.DB_NAME,     // Name of the database (chatsphere)
  waitForConnections: true,          // Wait if all connections are in use
  connectionLimit: 10,               // Maximum number of connections in the pool
  queueLimit: 0                      // Unlimited queueing of connection requests
});

// Convert pool to use Promises so we can use modern async/await syntax
const promisePool = pool.promise();

// Export the promise-based pool for use in other parts of the app
module.exports = promisePool;
