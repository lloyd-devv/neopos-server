const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

// --- DATABASE ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_JIsie6qltHp0@ep-wispy-waterfall-aeygt2p0-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

// --- GOOGLE SHEETS SETUP (Opsional) ---
// Ganti ID Spreadsheet Anda di sini
const SPREADSHEET_ID = 'GANTI_DENGAN_ID_SPREADSHEET_ANDA'; 

async function appendToSheet(data) {
    // Cek apakah file credentials.json ada
    if (!fs.existsSync('./credentials.json')) {
        console.log("Skipping Google Sheets: credentials.json not found.");
        return;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: './credentials.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Format Data: Tanggal, ID, Kasir, Metode, Total
        const values = [[data.date, data.id, data.cashier, data.method, data.total]];
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:E', // Pastikan nama sheet sesuai
            valueInputOption: 'USER_ENTERED',
            resource: { values },
        });
        console.log("Data sent to Google Sheets");
    } catch (e) {
        console.error("Google Sheets Error:", e.message);
    }
}

app.use(express.static(path.join(__dirname, 'public')));

// --- API ---

// 1. Init Data
app.get('/api/init', async (req, res) => {
  try {
    const products = await pool.query('SELECT * FROM products ORDER BY id ASC');
    const history = await pool.query('SELECT * FROM history ORDER BY date DESC');
    res.json({ products: products.rows, history: history.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Checkout (Simpan DB + Kirim Sheet)
app.post('/api/checkout', async (req, res) => {
  const { id, date, cashier, total, method, items, discount } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Simpan History (termasuk diskon)
    await client.query(
      'INSERT INTO history (id, date, cashier, total, method, items) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, date, cashier, total, method, JSON.stringify(items)]
    );

    // Update Stok
    for (const item of items) {
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.qty, item.id]);
    }

    await client.query('COMMIT');
    
    // Kirim ke Google Sheets (Async - tidak memblokir respon)
    appendToSheet({ date, id, cashier, method, total });

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// 3. Produk CRUD
app.post('/api/products', async (req, res) => {
  const { name, category, price, stock } = req.body;
  try {
    const r = await pool.query('INSERT INTO products (name, category, price, stock, icon) VALUES ($1, $2, $3, $4, $5) RETURNING *', [name, category, price, stock, 'fa-box']);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({error: err.message}); }
});

app.put('/api/products/:id', async (req, res) => {
    const { name, category, price, stock } = req.body;
    try {
      await pool.query('UPDATE products SET name=$1, category=$2, price=$3, stock=$4 WHERE id=$5', [name, category, price, stock, req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/history/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM history WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


