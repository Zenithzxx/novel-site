const db = require('../db');

async function checkAchievements(userId) {
    try {
        // Get user stats
        const [[user]] = await db.query('SELECT title FROM users WHERE id = ?', [userId]);
        if (!user) return;

        let currentTitle = user.title;
        let newTitle = currentTitle;

        // 1. Check Comments Count
        const [[commentStats]] = await db.query('SELECT COUNT(*) as count FROM comments WHERE user_id = ?', [userId]);
        if (commentStats.count >= 5) newTitle = 'Chatterbox';
        else if (commentStats.count >= 1) newTitle = 'Commenter';

        // 2. Check Reading Progress
        const [[progressStats]] = await db.query('SELECT COUNT(*) as count FROM reading_progress WHERE user_id = ?', [userId]);
        if (progressStats.count >= 10) newTitle = 'Scholar'; // Tier 2 of Bookworm
        else if (progressStats.count >= 5) newTitle = 'Bookworm';

        // 3. Check Favorites
        const [[favStats]] = await db.query('SELECT COUNT(*) as count FROM favorites WHERE user_id = ?', [userId]);
        if (favStats.count >= 3) newTitle = 'Collector';

        // 4. Check for "Veteran" (Read 10 AND Commented 5 AND Favorited 3)
        if (progressStats.count >= 10 && commentStats.count >= 5 && favStats.count >= 3) {
            newTitle = 'Veteran Reader';
        }

        // If title changed, update database and session
        if (newTitle !== currentTitle) {
            await db.query('UPDATE users SET title = ? WHERE id = ?', [newTitle, userId]);
        }
    } catch (err) {
        console.error('Achievement check error:', err);
    }
}

module.exports = checkAchievements;