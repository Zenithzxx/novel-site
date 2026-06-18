const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/authMiddleware');

// View My Library (Favorited Novels)
router.get('/my-library', requireLogin, async (req, res) => {
    try {
        const [novels] = await db.query(`
            SELECT novels.* FROM novels 
            JOIN favorites ON novels.id = favorites.novel_id 
            WHERE favorites.user_id = ?
            ORDER BY novels.created_at DESC
        `, [req.session.user.id]);
        
        res.render('my-library', { novels: novels });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// Add to Favorites
router.post('/favorites/add/:novelId', requireLogin, async (req, res) => {
    const novelId = req.params.novelId;
    try {
        await db.query('INSERT INTO favorites (user_id, novel_id) VALUES (?, ?)', 
            [req.session.user.id, novelId]);
        // Explicitly redirect to the novel page
        res.redirect(`/novel/${novelId}`);
    } catch (err) {
        // If it's already in favorites, just redirect back to the novel
        res.redirect(`/novel/${novelId}`);
    }
});

// Remove from Favorites
router.post('/favorites/remove/:novelId', requireLogin, async (req, res) => {
    const novelId = req.params.novelId;
    try {
        await db.query('DELETE FROM favorites WHERE user_id = ? AND novel_id = ?', 
            [req.session.user.id, novelId]);
        // Explicitly redirect to the novel page
        res.redirect(`/novel/${novelId}`);
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

module.exports = router;