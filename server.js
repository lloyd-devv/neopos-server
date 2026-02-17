const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

// --- 1. KONEKSI DATABASE (NEON) ---
// Ganti string di bawah dengan link asli Neon Anda!
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_JIsie6qltHp0@ep-wispy-waterfall-aeygt2p0-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

// --- 2. GOOGLE SHEETS (Opsional) ---
// Masukkan ID Spreadsheet dari URL Google Sheets Anda
const SPREADSHEET_ID = 'MASUKKAN_ID_SPREADSHEET_DISINI'; 

async function appendToSheet(data) {
    if (!fs.existsSync('./credentials.json')) return console.log("⚠️ Google Sheets: credentials.json tidak ditemukan. Lewati.");
    
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: './credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Format: Tanggal, ID, Kasir, Item (String), Metode, Total
        const itemsStr = data.items.map(i => `${i.name}(${i.qty})`).join(', ');
        const values = [[data.date, data.id, data.cashier, itemsStr, data.method, data.total]];
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:F',
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
        console.log("✅ Data terkirim ke Google Sheets");
    } catch (e) { console.error("❌ Google Sheets Error:", e.message); }
}

app.use(express.static(path.join(__dirname, 'public')));

// --- 3. API ROUTES ---

// Init Data (Produk & Riwayat)
app.get('/api/init', async (req, res) => {
  try {
    const p = await pool.query('SELECT * FROM products ORDER BY id ASC');
    const h = await pool.query('SELECT * FROM history ORDER BY date DESC');
    res.json({ products: p.rows, history: h.rows });
  } catch (err) { res.status(500).json({ error: "DB Connection Failed: " + err.message }); }
});

// Checkout (Transaksi)
app.post('/api/checkout', async (req, res) => {
  const { id, date, cashier, total, method, items, discount } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    // Simpan Riwayat
    await client.query('INSERT INTO history (id, date, cashier, total, method, items) VALUES ($1, $2, $3, $4, $5, $6)', 
      [id, date, cashier, total, method, JSON.stringify(items)]);
    
    // Kurangi Stok
    for (const item of items) {
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.qty, item.id]);
    }
    await client.query('COMMIT');
    
    // Kirim ke Google Sheets (Fire & Forget)
    appendToSheet({ id, date, cashier, total, method, items });
    
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Manajemen Produk
app.post('/api/products', async (req, res) => {
  const { name, category, price, stock } = req.body;
  try {
    const r = await pool.query('INSERT INTO products (name, category, price, stock, icon) VALUES ($1, $2, $3, $4, $5) RETURNING *', [name, category, price, stock, 'fa-box']);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({error: e.message}); }
});

app.put('/api/products/:id', async (req, res) => {
  const { name, category, price, stock } = req.body;
  try {
    await pool.query('UPDATE products SET name=$1, category=$2, price=$3, stock=$4 WHERE id=$5', [name, category, price, stock, req.params.id]);
    res.json({success:true});
  } catch (e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/products/:id', async (req, res) => {
  try { await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]); res.json({success:true}); } 
  catch (e) { res.status(500).json({error: e.message}); }
});

// Hapus Riwayat
app.delete('/api/history/:id', async (req, res) => {
  try { await pool.query('DELETE FROM history WHERE id=$1', [req.params.id]); res.json({success:true}); } 
  catch (e) { res.status(500).json({error: e.message}); }
});

// Serve Frontend
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 NeoPOS Server running on port ${PORT}`));
