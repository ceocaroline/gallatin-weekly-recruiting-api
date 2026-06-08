const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'gallatin2026';
const DATA_FILE = path.join(__dirname, 'data', 'dashboard.json');

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return null; }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/data', (req, res) => {
  const data = loadData();
  if (!data) return res.json({ empty: true });
  res.json(data);
});

app.post('/api/update', upload.fields([
  { name: 'chart', maxCount: 1 },
  { name: 'snapshot', maxCount: 1 },
  { name: 'onsites', maxCount: 1 },
  { name: 'hires', maxCount: 1 },
  { name: 'interviewers', maxCount: 1 },
  { name: 'roles', maxCount: 1 },
]), (req, res) => {
  const { password, reportDate, preparedBy } = req.body;

  if (password !== PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const existing = loadData() || {};
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

  saveData(updated);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
