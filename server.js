// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_JIsie6qltHp0@ep-wispy-waterfall-aeygt2p0-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); 

const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        category VARCHAR(50),
        price INTEGER,
        stock INTEGER,
        icon VARCHAR(50)
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS history (
        id VARCHAR(50) PRIMARY KEY,
        date TIMESTAMP,
        cashier VARCHAR(50),
        total INTEGER,
        method VARCHAR(20),
        items JSONB 
      );
    `);
    console.log("Database & Tabel Siap!");
  } catch (err) {
    console.error("Error Database:", err);
  }
};
initDb();


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

// Tambah Produk Baru
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

// Update Stok Produk (Manual Edit)
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  try {
    await pool.query('UPDATE products SET stock = $1 WHERE id = $2', [stock, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hapus Produk
app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PROSES TRANSAKSI (Checkout)
app.post('/api/checkout', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Mulai Transaksi Database

    const { id, date, cashier, total, method, items } = req.body;

    // 1. Simpan ke History
    await client.query(
      'INSERT INTO history (id, date, cashier, total, method, items) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, date, cashier, total, method, JSON.stringify(items)]
    );

    // 2. Kurangi Stok Produk
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
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// HAPUS TRANSAKSI (Void)
// Kembalikan stok barang
app.delete('/api/history/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    // 1. Ambil data item dari transaksi yang mau dihapus
    const trxRes = await client.query('SELECT items FROM history WHERE id = $1', [id]);
    if (trxRes.rows.length === 0) throw new Error('Transaksi tidak ditemukan');
    
    const items = trxRes.rows[0].items;

    // 2. Kembalikan Stok
    for (const item of items) {
      await client.query(
        'UPDATE products SET stock = stock + $1 WHERE id = $2',
        [item.qty, item.id]
      );
    }

    // 3. Hapus dari History
    await client.query('DELETE FROM history WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});



app.get('/api', (req, res) => {
  res.send('NeoPOS API is running...');
});


if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
}

module.exports = app;