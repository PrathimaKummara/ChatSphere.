// Import the mysql2 package
const mysql = require('mysql2');

// We use a connection pool instead of a single connection because:
// 1. It manages multiple connections automatically.
// 2. It reuses existing connections, which is faster and saves server resources.
// 3. It handles dropped connections more gracefully in a real-time app.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Convert pool to use Promises so we can use modern async/await syntax
const promisePool = pool.promise();

// Export the promise-based pool for use in other parts of the app
module.exports = promisePool;
