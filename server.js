const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// --- KONFIGURASI DATABASE ---
const pool = new Pool({
  // ⚠️ PASTIKAN LINK INI SESUAI DENGAN NEON DATABASE ANDA ⚠️
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_JIsie6qltHp0@ep-wispy-waterfall-aeygt2p0-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: {
    rejectUnauthorized: false
  }
});

// Serve file statis (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// --- API ROUTES ---

// 1. Ambil Semua Data (Produk & Riwayat)
app.get('/api/init', async (req, res) => {
  try {
    const products = await pool.query('SELECT * FROM products ORDER BY id ASC');
    const history = await pool.query('SELECT * FROM history ORDER BY date DESC');
    res.json({
      products: products.rows,
      history: history.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Transaksi Baru (Checkout)
app.post('/api/checkout', async (req, res) => {
  const { id, date, cashier, total, method, items } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Simpan ke Riwayat
    await client.query(
      'INSERT INTO history (id, date, cashier, total, method, items) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, date, cashier, total, method, JSON.stringify(items)]
    );

    // Kurangi Stok Barang
    for (const item of items) {
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.qty, item.id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 3. Tambah Produk Baru
app.post('/api/products', async (req, res) => {
  const { name, category, price, stock, icon } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (name, category, price, stock, icon) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, category, price, stock, icon]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update/Edit Produk (FITUR BARU)
app.put('/api/products/:id', async (req, res) => {
  const { name, category, price, stock } = req.body;
  try {
    await pool.query(
      'UPDATE products SET name=$1, category=$2, price=$3, stock=$4 WHERE id=$5',
      [name, category, price, stock, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Hapus Produk
app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Hapus Riwayat Laporan (FITUR BARU)
app.delete('/api/history/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM history WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route Default
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jalankan Server
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
    });
}

module.exports = app;
