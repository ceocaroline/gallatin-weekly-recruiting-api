const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'gallatin2026';

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dashboard (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Database ready');
}

async function loadData() {
  const result = await pool.query('SELECT data FROM dashboard WHERE id = 1');
  if (result.rows.length === 0) return null;
  return result.rows[0].data;
}

async function saveData(data) {
  await pool.query(`
    INSERT INTO dashboard (id, data, updated_at)
    VALUES (1, $1, NOW())
    ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()
  `, [data]);
}

app.get('/api/data', async (req, res) => {
  try {
    const data = await loadData();
    if (!data) return res.json({ empty: true });
    res.json(data);
  } catch (err) {
    console.error('Load error:', err);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

app.post('/api/update', upload.fields([
  { name: 'chart', maxCount: 1 },
  { name: 'snapshot', maxCount: 1 },
  { name: 'onsites', maxCount: 1 },
  { name: 'hires', maxCount: 1 },
  { name: 'interviewers', maxCount: 1 },
  { name: 'roles', maxCount: 1 },
]), async (req, res) => {
  const { password, reportDate, preparedBy } = req.body;

  if (password !== PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  try {
    const existing = await loadData() || {};
    const updated = { ...existing, reportDate, preparedBy, updatedAt: new Date().toISOString() };

    const csvFields = ['snapshot', 'onsites', 'hires', 'interviewers', 'roles'];
    for (const field of csvFields) {
      if (req.files[field]) {
        updated[field] = req.files[field][0].buffer.toString('utf8');
      }
    }

    if (req.files['chart']) {
      const buf = req.files['chart'][0].buffer;
      const mime = req.files['chart'][0].mimetype;
      updated.chart = `data:${mime};base64,${buf.toString('base64')}`;
    }

    await saveData(updated);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
