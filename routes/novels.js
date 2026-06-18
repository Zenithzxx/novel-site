const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/authMiddleware');

// --- READER & HOME ROUTES ---

// Home Page / Reader Dashboard (Shows all novels)
router.get('/', async (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return res.redirect('/admin-dashboard');
    }
    try {
        const [novels] = await db.query('SELECT * FROM novels ORDER BY created_at DESC');
        res.render('reader-dashboard', { novels: novels });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// View a specific novel
router.get('/novel/:id', requireLogin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM novels WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.send('Novel not found.');
        
        const novel = rows[0];
        
        // Check if user already favorited this novel
        const [favRows] = await db.query('SELECT * FROM favorites WHERE user_id = ? AND novel_id = ?', 
            [req.session.user.id, req.params.id]);
        const isFavorited = favRows.length > 0;

        res.render('novel', { novel: novel, isFavorited: isFavorited });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// --- ADMIN ROUTES ---

// Admin Dashboard
router.get('/admin-dashboard', requireLogin, requireAdmin, async (req, res) => {
    try {
        const [novels] = await db.query('SELECT * FROM novels ORDER BY created_at DESC');
        res.render('admin-dashboard', { novels: novels, user: req.session.user });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// Form to create a new novel
router.get('/novels/new', requireLogin, requireAdmin, (req, res) => {
    res.render('novel-form', { novel: null, action: '/novels/create' });
});

// Handle creating a novel
router.post('/novels/create', requireLogin, requireAdmin, async (req, res) => {
    const { title, description, content } = req.body;
    const authorId = req.session.user.id;
    try {
        await db.query('INSERT INTO novels (title, description, content, author_id) VALUES (?, ?, ?, ?)', 
            [title, description, content, authorId]);
        res.redirect('/admin-dashboard');
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// Form to edit a novel
router.get('/novels/:id/edit', requireLogin, requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM novels WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.send('Novel not found.');
        res.render('novel-form', { novel: rows[0], action: `/novels/${req.params.id}/update` });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// Handle updating a novel
router.post('/novels/:id/update', requireLogin, requireAdmin, async (req, res) => {
    const { title, description, content } = req.body;
    try {
        await db.query('UPDATE novels SET title = ?, description = ?, content = ? WHERE id = ?', 
            [title, description, content, req.params.id]);
        res.redirect('/admin-dashboard');
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// Handle deleting a novel
router.post('/novels/:id/delete', requireLogin, requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM novels WHERE id = ?', [req.params.id]);
        res.redirect('/admin-dashboard');
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

module.exports = router;