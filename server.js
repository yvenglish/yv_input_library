require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'yv_input_library',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initializeDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        plan VARCHAR(50) NOT NULL,
        last_login DATETIME DEFAULT NULL
      )
    `);

    // Safely add status column if it doesn't exist
    try {
      await pool.query("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'");
    } catch (e) {
      // Ignore if column already exists (ER_DUP_FIELDNAME)
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        episode_id VARCHAR(100) NOT NULL,
        UNIQUE KEY user_episode (user_id, episode_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        episode_id VARCHAR(100) NOT NULL,
        UNIQUE KEY user_episode (user_id, episode_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        user_id VARCHAR(50) PRIMARY KEY,
        theme VARCHAR(20) DEFAULT 'dark'
      )
    `);

    // Seed initial users if table is empty
    const [usersResult] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (usersResult[0].count === 0) {
      const USERS = {'paulo-0507':{name:'Paulo',plan:'foundation'},'pamela-0204':{name:'Pamela',plan:'fluency'},'adjalma-0205':{name:'Adjalma',plan:'fluency'},'evellyn-0508':{name:'Evellyn',plan:'foundation'},'cristiani01':{name:'Cristiani',plan:'foundation'},'314724':{name:'Yasmin',plan:'master'}};
      for (const [id, user] of Object.entries(USERS)) {
        await pool.query("INSERT INTO users (id, name, plan, status) VALUES (?, ?, ?, 'active')", [id, user.name, user.plan]);
      }
      console.log('Database seeded with initial users.');
    }

    console.log("Database tables initialized successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

initializeDB();

// --- API ROUTES ---

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [password]);
    if (rows.length > 0) {
      const user = rows[0];
      if (user.status === 'inactive') {
        return res.status(403).json({ error: 'Conta inativa' });
      }
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [password]);
      res.json({ id: user.id, name: user.name, plan: user.plan });
    } else {
      res.status(401).json({ error: 'Senha incorreta' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin endpoints
app.get('/api/admin/users', async (req, res) => {
  const { masterId } = req.query;
  const [master] = await pool.query('SELECT plan FROM users WHERE id = ?', [masterId]);
  if (!master.length || master[0].plan !== 'master') return res.status(403).json({error: 'Forbidden'});
  
  try {
    const [users] = await pool.query('SELECT id, name, plan, status, last_login FROM users ORDER BY name ASC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/admin/users', async (req, res) => {
  const { masterId, id, name, plan, status = 'active' } = req.body;
  const [master] = await pool.query('SELECT plan FROM users WHERE id = ?', [masterId]);
  if (!master.length || master[0].plan !== 'master') return res.status(403).json({error: 'Forbidden'});

  try {
    await pool.query('INSERT INTO users (id, name, plan, status) VALUES (?, ?, ?, ?)', [id, name, plan, status]);
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update student
app.put('/api/admin/users/:oldId', async (req, res) => {
  const { oldId } = req.params;
  const { masterId, id: newId, name, plan, status } = req.body;
  
  const [master] = await pool.query('SELECT plan FROM users WHERE id = ?', [masterId]);
  if (!master.length || master[0].plan !== 'master') return res.status(403).json({error: 'Forbidden'});

  try {
    // 1. Temporarily insert the new user if ID changed, to avoid foreign key issues (if any)
    // Or just update the PK directly. In MySQL, updating PK is allowed unless there are RESTRICT foreign keys.
    // We don't have explicit foreign keys, so we can just update the PK.
    await pool.query('UPDATE users SET id = ?, name = ?, plan = ?, status = ? WHERE id = ?', [newId, name, plan, status, oldId]);
    
    // 2. If ID changed, update all related tables manually
    if (newId !== oldId) {
      await pool.query('UPDATE progress SET user_id = ? WHERE user_id = ?', [newId, oldId]);
      await pool.query('UPDATE favorites SET user_id = ? WHERE user_id = ?', [newId, oldId]);
      await pool.query('UPDATE settings SET user_id = ? WHERE user_id = ?', [newId, oldId]);
    }
    
    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete student
app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  const { masterId } = req.query; // using query for DELETE

  const [master] = await pool.query('SELECT plan FROM users WHERE id = ?', [masterId]);
  if (!master.length || master[0].plan !== 'master') return res.status(403).json({error: 'Forbidden'});

  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    await pool.query('DELETE FROM progress WHERE user_id = ?', [id]);
    await pool.query('DELETE FROM favorites WHERE user_id = ?', [id]);
    await pool.query('DELETE FROM settings WHERE user_id = ?', [id]);
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET user data (progress, favorites, settings)
app.get('/api/userdata/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [progressRows] = await pool.query('SELECT episode_id FROM progress WHERE user_id = ?', [userId]);
    const [favoritesRows] = await pool.query('SELECT episode_id FROM favorites WHERE user_id = ?', [userId]);
    const [settingsRows] = await pool.query('SELECT theme FROM settings WHERE user_id = ?', [userId]);

    const progress = progressRows.map(r => r.episode_id);
    const favorites = favoritesRows.map(r => r.episode_id);
    const theme = settingsRows.length > 0 ? settingsRows[0].theme : 'dark';

    res.json({ progress, favorites, theme });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST toggle progress
app.post('/api/progress', async (req, res) => {
  const { userId, episodeId } = req.body;
  try {
    const [existing] = await pool.query('SELECT id FROM progress WHERE user_id = ? AND episode_id = ?', [userId, episodeId]);
    if (existing.length > 0) {
      await pool.query('DELETE FROM progress WHERE id = ?', [existing[0].id]);
      res.json({ status: 'removed' });
    } else {
      await pool.query('INSERT INTO progress (user_id, episode_id) VALUES (?, ?)', [userId, episodeId]);
      res.json({ status: 'added' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// POST toggle favorite
app.post('/api/favorites', async (req, res) => {
  const { userId, episodeId } = req.body;
  try {
    const [existing] = await pool.query('SELECT id FROM favorites WHERE user_id = ? AND episode_id = ?', [userId, episodeId]);
    if (existing.length > 0) {
      await pool.query('DELETE FROM favorites WHERE id = ?', [existing[0].id]);
      res.json({ status: 'removed' });
    } else {
      await pool.query('INSERT INTO favorites (user_id, episode_id) VALUES (?, ?)', [userId, episodeId]);
      res.json({ status: 'added' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// POST update theme
app.post('/api/settings/theme', async (req, res) => {
  const { userId, theme } = req.body;
  try {
    await pool.query('INSERT INTO settings (user_id, theme) VALUES (?, ?) ON DUPLICATE KEY UPDATE theme = ?', [userId, theme, theme]);
    res.json({ status: 'updated', theme });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
