const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Auth middleware - simple API key check
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get merchants/stores
app.get('/api/merchants', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT store_id, 
             COUNT(*) as total_orders,
             SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins,
             SUM(total_price) as total_revenue
      FROM orders 
      GROUP BY store_id
    `);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get customers with pagination
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const { store_id, limit = 100, offset = 0 } = req.query;
    let query = 'SELECT * FROM customers';
    const params = [];
    
    if (store_id && store_id !== 'all') {
      query += ' WHERE store_id = ?';
      params.push(store_id);
    }
    
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.execute(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM customers';
    if (store_id && store_id !== 'all') {
      countQuery += ' WHERE store_id = ?';
    }
    const [countResult] = await pool.execute(
      countQuery, 
      store_id && store_id !== 'all' ? [store_id] : []
    );
    
    res.json({ 
      data: rows, 
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get orders with pagination
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { store_id, limit = 100, offset = 0 } = req.query;
    let query = 'SELECT * FROM orders';
    const params = [];
    
    if (store_id && store_id !== 'all') {
      query += ' WHERE store_id = ?';
      params.push(store_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.execute(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM orders';
    if (store_id && store_id !== 'all') {
      countQuery += ' WHERE store_id = ?';
    }
    const [countResult] = await pool.execute(
      countQuery, 
      store_id && store_id !== 'all' ? [store_id] : []
    );
    
    res.json({ 
      data: rows, 
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get analytics summary
app.get('/api/analytics', authMiddleware, async (req, res) => {
  try {
    const { store_id, start_date, end_date } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (store_id && store_id !== 'all') {
      whereClause = 'WHERE store_id = ?';
      params.push(store_id);
    }
    
    if (start_date && end_date) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ' created_at BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    const [summary] = await pool.execute(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins,
        SUM(CASE WHEN opt_in = 0 OR opt_in IS NULL THEN 1 ELSE 0 END) as opt_outs,
        ROUND(AVG(total_price), 2) as avg_order_value,
        SUM(total_price) as total_revenue
      FROM orders ${whereClause}
    `, params);
    
    // Geographic breakdown
    const [geoBreakdown] = await pool.execute(`
      SELECT 
        city,
        country,
        COUNT(*) as order_count,
        SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins,
        ROUND(SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as opt_in_rate
      FROM orders ${whereClause}
      GROUP BY city, country
      ORDER BY order_count DESC
      LIMIT 20
    `, params);
    
    // Store breakdown
    const [storeBreakdown] = await pool.execute(`
      SELECT 
        store_id,
        COUNT(*) as order_count,
        SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins,
        ROUND(SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as opt_in_rate,
        ROUND(AVG(total_price), 2) as avg_order_value,
        SUM(total_price) as total_revenue
      FROM orders ${whereClause ? whereClause.replace('store_id = ? AND', '').replace('WHERE store_id = ?', '') : ''}
      GROUP BY store_id
      ORDER BY order_count DESC
    `, start_date && end_date ? [start_date, end_date] : []);
    
    res.json({
      summary: summary[0],
      geographic: geoBreakdown,
      stores: storeBreakdown
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get line items for an order
app.get('/api/line-items/:orderId', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM line_items WHERE order_id = ?',
      [req.params.orderId]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching line items:', error);
    res.status(500).json({ error: error.message });
  }
});

// Custom query endpoint (use with caution - only for read operations)
app.post('/api/query', authMiddleware, async (req, res) => {
  try {
    const { table, select = '*', where, orderBy, limit = 100, offset = 0 } = req.body;
    
    // Whitelist allowed tables
    const allowedTables = ['customers', 'orders', 'line_items', 'merchants'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    let query = `SELECT ${select} FROM ${table}`;
    const params = [];
    
    if (where) {
      const conditions = Object.entries(where)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
      query += ` WHERE ${conditions}`;
    }
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`MySQL Proxy running on port ${PORT}`);
});
