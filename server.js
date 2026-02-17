const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// --- KONFIGURASI DATABASE ---
const pool = new Pool({
  // GANTI LINK DI BAWAH INI DENGAN LINK NEON ANDA:
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_JIsie6qltHp0@ep-wispy-waterfall-aeygt2p0-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: {
    rejectUnauthorized: false
  }
});

// Melayani file statis (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// --- API ROUTES (Jembatan Data) ---

// 1. Ambil Data Awal (Produk & Riwayat)
app.get('/api/init', async (req, res) => {
  try {
    const products = await pool.query('SELECT * FROM products ORDER BY id ASC');
    const history = await pool.query('SELECT * FROM history ORDER BY date DESC');
    res.json({
      products: products.rows,
      history: history.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal ambil data' });
  }
});

// 2. Transaksi Baru (Kurangi Stok & Simpan Laporan)
app.post('/api/checkout', async (req, res) => {
  const { id, date, cashier, total, method, items } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Mulai Transaksi Aman

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

    await client.query('COMMIT'); // Simpan Permanen
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK'); // Batalkan jika error
    console.error(err);
    res.status(500).json({ error: 'Gagal transaksi' });
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

// 4. Hapus Produk
app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route Default untuk Vercel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// JALANKAN SERVER
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
    });
}

module.exports = app;