const express = require('express');
const router = express.Router();
const db = require('../db');
const checkAchievements = require('../helpers/achievements');
const { requireLogin } = require('../middleware/authMiddleware');

// View Profile
router.get('/profile', requireLogin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        if (rows.length === 0) return res.redirect('/logout');
        if (!req.session.user.title || req.session.user.title !== rows[0].title) req.session.user.title = rows[0].title;
        res.render('profile', { user: rows[0], success: null, error: null });
    } catch (err) { res.send('Error: ' + err.message); }
});

// Update Profile
router.post('/profile/update', requireLogin, async (req, res) => {
    const { username, bio } = req.body;
    const userId = req.session.user.id;
    try {
        await db.query('UPDATE users SET username = ?, bio = ? WHERE id = ?', [username, bio, userId]);
        req.session.user.username = username;
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        res.render('profile', { user: rows[0], success: 'Profile updated successfully!', error: null });
    } catch (err) {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        res.render('profile', { user: rows[0], success: null, error: 'Username already taken.' });
    }
});

module.exports = router;