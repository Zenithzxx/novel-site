const express = require('express');
const checkAchievements = require('../helpers/achievements');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const { requireLogin } = require('../middleware/authMiddleware');

// Avatar Upload Setup
const avatarStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, 'avatar-' + req.session.user.id + '-' + Date.now() + path.extname(file.originalname));
    }
});
const uploadAvatar = multer({ storage: avatarStorage });

// View Profile
router.get('/profile', requireLogin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        if (rows.length === 0) return res.redirect('/logout');
        
        // Sync session title with database
        if (!req.session.user.title || req.session.user.title !== rows[0].title) {
            req.session.user.title = rows[0].title;
        }
        res.render('profile', { user: rows[0], success: null, error: null });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// Update Profile (Avatar, Username, Bio)
router.post('/profile/update', requireLogin, uploadAvatar.single('avatar'), async (req, res) => {
    const { username, bio } = req.body;
    const userId = req.session.user.id;
    const avatar = req.file ? '/uploads/' + req.file.filename : null;
    
    try {
        if (avatar) {
            await db.query('UPDATE users SET username = ?, bio = ?, avatar = ? WHERE id = ?', [username, bio, avatar, userId]);
        } else {
            await db.query('UPDATE users SET username = ?, bio = ? WHERE id = ?', [username, bio, userId]);
        }
        
        // Update session username so the navbar updates instantly
        req.session.user.username = username;
        
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        res.render('profile', { user: rows[0], success: 'Profile updated successfully!', error: null });
    } catch (err) {
        // If username is already taken, MySQL throws an error. We catch it here.
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        res.render('profile', { user: rows[0], success: null, error: 'Username already taken.' });
    }
});

module.exports = router;