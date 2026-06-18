const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../db');

// Register Page
router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// Register Logic
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Change "reader" to 'reader'
        await db.query("INSERT INTO users (username, password, role) VALUES (?, ?, 'reader')", [username, hashedPassword]);
        res.redirect('/login');
    } catch (err) {
        console.error("Registration Error:", err.message);
        res.render('register', { error: 'Username already taken or error occurred.' });
    }
});

// Login Page
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Login Logic
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.render('login', { error: 'User not found' });
        }
        
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        
        if (!match) {
            return res.render('login', { error: 'Incorrect password' });
        }

        req.session.user = { id: user.id, username: user.username, role: user.role };
        
                if (user.role === 'admin') {
            res.redirect('/admin-dashboard');
        } else {
            res.redirect('/'); // <--- CHANGE THIS TO '/'
        }
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;