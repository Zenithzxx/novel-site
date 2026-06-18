const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/authMiddleware');

// View Notifications
router.get('/notifications', requireLogin, async (req, res) => {
    try {
        // Mark all as read
        await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.session.user.id]);
        
        // Fetch them to display
        const [notifications] = await db.query(`
            SELECT notifications.*, novels.title as novel_title 
            FROM notifications 
            JOIN novels ON notifications.novel_id = novels.id 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [req.session.user.id]);
        
        res.render('notifications', { notifications });
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

module.exports = router;