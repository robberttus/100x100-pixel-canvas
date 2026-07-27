const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const GRID_SIZE = 100;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Valid palette colors
const ALLOWED_COLORS = new Set([
  '#FF0000', // Red
  '#FFA500', // Orange
  '#FFFF00', // Yellow
  '#90EE90', // Light Green
  '#008000', // Dark Green
  '#ADD8E6', // Light Blue
  '#0000FF', // Dark Blue
  '#FFC0CB', // Pink
  '#800080', // Purple
  '#000000', // Black
  '#FFFFFF'  // White
]);

// 100x100 grid array initialized to white (#FFFFFF)
const grid = new Array(GRID_SIZE * GRID_SIZE).fill('#FFFFFF');

// In-memory Device ID tracking for 5-minute cooldown (Device-independent)
const deviceCooldowns = new Map();

// Database Pool Setup (PostgreSQL on Render/Supabase or fallback local JSON file)
let pool = null;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
  pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });
}

// Initialize persistence storage
async function initStorage() {
  if (pool) {
    try {
      console.log('Connecting to PostgreSQL database...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pixels (
          x INT NOT NULL,
          y INT NOT NULL,
          color VARCHAR(10) NOT NULL,
          PRIMARY KEY (x, y)
        );
      `);

      const res = await pool.query('SELECT x, y, color FROM pixels;');
      res.rows.forEach(row => {
        if (row.x >= 0 && row.x < GRID_SIZE && row.y >= 0 && row.y < GRID_SIZE) {
          grid[row.y * GRID_SIZE + row.x] = row.color;
        }
      });
      console.log(`Loaded ${res.rows.length} pixels from PostgreSQL database.`);
    } catch (err) {
      console.error('PostgreSQL initialization error:', err.message);
    }
  } else {
    // Local JSON fallback
    const jsonPath = path.join(__dirname, 'pixels.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length === GRID_SIZE * GRID_SIZE) {
          saved.forEach((c, idx) => grid[idx] = c);
          console.log('Loaded pixels from local pixels.json file.');
        }
      } catch (e) {
        console.error('Error reading pixels.json:', e.message);
      }
    }
  }
}

// Save a pixel to database or file
async function savePixel(x, y, color) {
  if (pool) {
    try {
      await pool.query(`
        INSERT INTO pixels (x, y, color)
        VALUES ($1, $2, $3)
        ON CONFLICT (x, y) DO UPDATE SET color = EXCLUDED.color;
      `, [x, y, color]);
    } catch (err) {
      console.error('Database write error:', err.message);
    }
  } else {
    // Async save to file
    const jsonPath = path.join(__dirname, 'pixels.json');
    fs.writeFile(jsonPath, JSON.stringify(grid), (err) => {
      if (err) console.error('JSON write error:', err.message);
    });
  }
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io real-time connection logic
io.on('connection', (socket) => {
  // Send current grid state on connect
  socket.emit('init_grid', grid);

  // Check cooldown status for a specific device ID
  socket.on('check_cooldown', (deviceId) => {
    if (!deviceId) return;
    const lastPlaced = deviceCooldowns.get(deviceId) || 0;
    const now = Date.now();
    const elapsed = now - lastPlaced;
    if (elapsed < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - elapsed;
      socket.emit('cooldown_status', { active: true, remainingMs });
    }
  });

  // Handle pixel placement attempt
  socket.on('place_pixel', async (data) => {
    const { x, y, color, deviceId } = data;

    // 1. Validation
    if (
      typeof x !== 'number' || typeof y !== 'number' ||
      x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE ||
      !ALLOWED_COLORS.has(color) ||
      !deviceId || typeof deviceId !== 'string'
    ) {
      return socket.emit('pixel_error', { message: 'Invalid placement data.' });
    }

    // 2. Cooldown check per Device ID (independent per device)
    const currentTime = Date.now();
    const lastPlacement = deviceCooldowns.get(deviceId) || 0;
    const timePassed = currentTime - lastPlacement;

    if (timePassed < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - timePassed;
      return socket.emit('cooldown_error', { remainingMs });
    }

    // 3. Update state & register cooldown for this specific device
    const index = y * GRID_SIZE + x;
    grid[index] = color;
    deviceCooldowns.set(deviceId, currentTime);

    // Save to DB / file persistence
    await savePixel(x, y, color);

    // 4. Broadcast update to ALL users (Last-Write-Wins)
    io.emit('pixel_updated', { x, y, color });

    // Confirm to sender and send cooldown status
    socket.emit('cooldown_status', { active: true, remainingMs: COOLDOWN_MS });
  });
});

// Start server after initializing storage
initStorage().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
