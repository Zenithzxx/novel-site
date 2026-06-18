const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const { requireLogin, requireAdmin } = require('../middleware/authMiddleware');

// Multer Setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, 'novel-cover-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Home Page / Reader Dashboard (Shows all novels with pagination)
router.get('/', async (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return res.redirect('/admin-dashboard');
    }
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3; // 3 novels per page
        const offset = (page - 1) * limit;

        const [countRows] = await db.query('SELECT COUNT(*) as count FROM novels');
        const totalNovels = countRows[0].count;
        const totalPages = Math.ceil(totalNovels / limit);

        const [novels] = await db.query('SELECT * FROM novels ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
        
        res.render('reader-dashboard', { 
            novels: novels, 
            currentPage: page, 
            totalPages: totalPages 
        });
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
        
        const [favRows] = await db.query('SELECT * FROM favorites WHERE user_id = ? AND novel_id = ?', 
            [req.session.user.id, req.params.id]);
        const isFavorited = favRows.length > 0;

        res.render('novel', { novel: novel, isFavorited: isFavorited });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

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
router.post('/novels/create', requireLogin, requireAdmin, (req, res, next) => {
    upload.single('coverImage')(req, res, function (err) {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).send('Upload error: ' + err.message);
        }
        next();
    });
}, async (req, res) => {
    const { title, description, content } = req.body;
    const authorId = req.session.user.id;
    const coverImage = req.file ? '/uploads/' + req.file.filename : null;
    try {
        await db.query('INSERT INTO novels (title, description, content, cover_image, author_id) VALUES (?, ?, ?, ?, ?)', 
            [title, description, content, coverImage, authorId]);
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
router.post('/novels/:id/update', requireLogin, requireAdmin, (req, res, next) => {
    upload.single('coverImage')(req, res, function (err) {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).send('Upload error: ' + err.message);
        }
        next();
    });
}, async (req, res) => {
    const { title, description, content } = req.body;
    const coverImage = req.file ? '/uploads/' + req.file.filename : null;
    
    try {
        if (coverImage) {
            await db.query('UPDATE novels SET title = ?, description = ?, content = ?, cover_image = ? WHERE id = ?', 
                [title, description, content, coverImage, req.params.id]);
        } else {
            await db.query('UPDATE novels SET title = ?, description = ?, content = ? WHERE id = ?', 
                [title, description, content, req.params.id]);
        }
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