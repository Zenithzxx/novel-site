const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/authMiddleware');

// View Profile
router.get('/profile', requireLogin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        if (rows.length === 0) return res.redirect('/logout');
        
        res.render('profile', { user: rows[0], success: null });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// Update Profile
router.post('/profile/update', requireLogin, async (req, res) => {
    const { bio } = req.body;
    try {
        await db.query('UPDATE users SET bio = ? WHERE id = ?', [bio, req.session.user.id]);
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        
        res.render('profile', { user: rows[0], success: 'Profile updated successfully!' });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

module.exports = router;