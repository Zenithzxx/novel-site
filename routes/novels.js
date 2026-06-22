const express = require('express');
const router = express.Router();
const db = require('../db');
const checkAchievements = require('../helpers/achievements');
const { requireLogin, requireAdmin } = require('../middleware/authMiddleware');

// Home Page
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const offset = (page - 1) * limit;
        
        const search = req.query.search || '';
        const genreFilter = req.query.genre || '';
        
        let query = 'SELECT * FROM novels WHERE publish_date <= NOW()';
        let countQuery = 'SELECT COUNT(*) as count FROM novels WHERE publish_date <= NOW()';
        const params = [];
        
        if (search) {
            query += ' AND title LIKE ?';
            countQuery += ' AND title LIKE ?';
            params.push(`%${search}%`);
        }
        if (genreFilter) {
            query += ' AND genre = ?';
            countQuery += ' AND genre = ?';
            params.push(genreFilter);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        
        const [countRows] = await db.query(countQuery, params);
        const totalPages = Math.ceil(countRows[0].count / limit);
        const [novels] = await db.query(query, [...params, limit, offset]);
        
        let continueReading = null;
        if (req.session.user) {
            const [progressRows] = await db.query(`
                SELECT chapters.id as chapter_id, chapters.title as chapter_title, novels.id as novel_id, novels.title as novel_title 
                FROM reading_progress 
                JOIN chapters ON reading_progress.chapter_id = chapters.id 
                JOIN novels ON chapters.novel_id = novels.id 
                WHERE reading_progress.user_id = ? 
                ORDER BY reading_progress.read_at DESC 
                LIMIT 1
            `, [req.session.user.id]);
            if (progressRows.length > 0) continueReading = progressRows[0];
        }
        
        res.render('reader-dashboard', { novels, currentPage: page, totalPages: totalPages || 1, search, genreFilter, continueReading });
    } catch (err) { res.send('Error: ' + err.message); }
});

// View Novel
router.get('/novel/:id', requireLogin, async (req, res) => {
    try {
        const [novelRows] = await db.query('SELECT * FROM novels WHERE id = ? AND publish_date <= NOW()', [req.params.id]);
        if (novelRows.length === 0) return res.send('Novel not found or not published yet.');
        const novel = novelRows[0];
        const [chapters] = await db.query('SELECT * FROM chapters WHERE novel_id = ? AND publish_date <= NOW() ORDER BY created_at ASC', [req.params.id]);
        const [readRows] = await db.query('SELECT chapter_id FROM reading_progress WHERE user_id = ?', [req.session.user.id]);
        const readChapters = readRows.map(r => r.chapter_id);
        const [favRows] = await db.query('SELECT * FROM favorites WHERE user_id = ? AND novel_id = ?', [req.session.user.id, req.params.id]);
        const isFavorited = favRows.length > 0;

        res.render('novel', { novel, chapters, isFavorited, readChapters });
    } catch (err) { res.send('Error: ' + err.message); }
});

// Read specific chapter
router.get('/novel/:novelId/chapter/:chapterId', requireLogin, async (req, res) => {
    try {
        const [chapterRows] = await db.query('SELECT * FROM chapters WHERE id = ? AND novel_id = ? AND publish_date <= NOW()', [req.params.chapterId, req.params.novelId]);
        if (chapterRows.length === 0) return res.send('Chapter not found or not published yet.');
        const chapter = chapterRows[0];

        await db.query('INSERT IGNORE INTO reading_progress (user_id, chapter_id) VALUES (?, ?)', [req.session.user.id, chapter.id]);
        await db.query('UPDATE chapters SET views = views + 1 WHERE id = ?', [chapter.id]);
        await checkAchievements(req.session.user.id);

        const [comments] = await db.query(`
            SELECT comments.*, users.username, users.title 
            FROM comments 
            JOIN users ON comments.user_id = users.id 
            WHERE chapter_id = ? ORDER BY comments.created_at DESC
        `, [req.params.chapterId]);

        const [nextRows] = await db.query('SELECT id, title FROM chapters WHERE novel_id = ? AND publish_date <= NOW() AND id > ? ORDER BY id ASC LIMIT 1', [req.params.novelId, chapter.id]);
        const [prevRows] = await db.query('SELECT id, title FROM chapters WHERE novel_id = ? AND publish_date <= NOW() AND id < ? ORDER BY id DESC LIMIT 1', [req.params.novelId, chapter.id]);
        
        res.render('chapter', { chapter, novelId: req.params.novelId, comments, nextChapter: nextRows[0] || null, prevChapter: prevRows[0] || null });
    } catch (err) { res.send('Error: ' + err.message); }
});

// Handle posting a comment
router.post('/novel/:novelId/chapter/:chapterId/comment', requireLogin, async (req, res) => {
    try {
        await db.query('INSERT INTO comments (chapter_id, user_id, comment) VALUES (?, ?, ?)', [req.params.chapterId, req.session.user.id, req.body.comment]);
        await checkAchievements(req.session.user.id);
        res.redirect(`/novel/${req.params.novelId}/chapter/${req.params.chapterId}#comments`);
    } catch (err) { res.send('Error: ' + err.message); }
});

// Admin Dashboard
router.get('/admin-dashboard', requireLogin, requireAdmin, async (req, res) => {
    try {
        const [novels] = await db.query('SELECT * FROM novels ORDER BY created_at DESC');
        const [stats] = await db.query('SELECT SUM(views) as totalViews, COUNT(*) as totalChapters FROM chapters');
        res.render('admin-dashboard', { novels, user: req.session.user, totalViews: stats[0].totalViews || 0 });
    } catch (err) { res.send('Error: ' + err.message); }
});

// Form to create a new novel
router.get('/novels/new', requireLogin, requireAdmin, (req, res) => res.render('novel-form', { novel: null, action: '/novels/create' }));

// Handle creating a novel
router.post('/novels/create', requireLogin, requireAdmin, async (req, res) => {
    const { title, description, genre, content, publish_date } = req.body;
    try {
        await db.query('INSERT INTO novels (title, description, genre, content, author_id, publish_date) VALUES (?, ?, ?, ?, ?, ?)', 
            [title, description, genre, content, req.session.user.id, publish_date]);
        res.redirect('/admin-dashboard');
    } catch (err) { res.send('Error: ' + err.message); }
});

// Form to edit a novel
router.get('/novels/:id/edit', requireLogin, requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM novels WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.send('Novel not found.');
        res.render('novel-form', { novel: rows[0], action: `/novels/${req.params.id}/update` });
    } catch (err) { res.send('Error: ' + err.message); }
});

// Handle updating a novel
router.post('/novels/:id/update', requireLogin, requireAdmin, async (req, res) => {
    const { title, description, genre, content, publish_date } = req.body;
    try {
        await db.query('UPDATE novels SET title = ?, description = ?, genre = ?, content = ?, publish_date = ? WHERE id = ?', 
            [title, description, genre, content, publish_date, req.params.id]);
        res.redirect('/admin-dashboard');
    } catch (err) { res.send('Error: ' + err.message); }
});

// Handle deleting a novel
router.post('/novels/:id/delete', requireLogin, requireAdmin, async (req, res) => {
    try {
        const [chapters] = await db.query('SELECT id FROM chapters WHERE novel_id = ?', [req.params.id]);
        if (chapters.length > 0) await db.query('DELETE FROM reading_progress WHERE chapter_id IN (?)', [chapters.map(c => c.id)]);
        await db.query('DELETE FROM favorites WHERE novel_id = ?', [req.params.id]);
        await db.query('DELETE FROM novels WHERE id = ?', [req.params.id]);
        res.redirect('/admin-dashboard');
    } catch (err) { res.send('Error: ' + err.message); }
});

// Chapter Management Routes
router.get('/admin/novel/:id/chapters', requireLogin, requireAdmin, async (req, res) => {
    try {
        const [novelRows] = await db.query('SELECT * FROM novels WHERE id = ?', [req.params.id]);
        const [chapters] = await db.query('SELECT * FROM chapters WHERE novel_id = ? ORDER BY created_at ASC', [req.params.id]);
        res.render('admin-chapters', { novel: novelRows[0], chapters });
    } catch (err) { res.send('Error: ' + err.message); }
});

router.get('/admin/novel/:id/chapters/new', requireLogin, requireAdmin, async (req, res) => {
    const [novelRows] = await db.query('SELECT * FROM novels WHERE id = ?', [req.params.id]);
    res.render('chapter-form', { novel: novelRows[0], chapter: null, action: `/admin/novel/${req.params.id}/chapters/create` });
});

router.post('/admin/novel/:id/chapters/create', requireLogin, requireAdmin, async (req, res) => {
    const { title, content, publish_now, publish_date } = req.body;
    const finalDate = publish_now ? new Date() : publish_date;
    try {
        const [result] = await db.query('INSERT INTO chapters (novel_id, title, content, publish_date) VALUES (?, ?, ?, ?)', [req.params.id, title, content, finalDate]);
        const [followers] = await db.query('SELECT user_id FROM favorites WHERE novel_id = ?', [req.params.id]);
        if (followers.length > 0) {
            let q = 'INSERT INTO notifications (user_id, novel_id, chapter_id, message) VALUES ';
            let p = [];
            followers.forEach((f, i) => { if(i>0) q+=', '; q+='(?, ?, ?, ?)'; p.push(f.user_id, req.params.id, result.insertId, `New chapter posted: ${title}`); });
            await db.query(q, p);
        }
        res.redirect(`/admin/novel/${req.params.id}/chapters`);
    } catch (err) { res.send('Error: ' + err.message); }
});

router.get('/admin/chapter/:chapterId/edit', requireLogin, requireAdmin, async (req, res) => {
    try {
        const [c] = await db.query('SELECT * FROM chapters WHERE id = ?', [req.params.chapterId]);
        const [n] = await db.query('SELECT * FROM novels WHERE id = ?', [c[0].novel_id]);
        res.render('chapter-form', { novel: n[0], chapter: c[0], action: `/admin/chapter/${req.params.chapterId}/update` });
    } catch (err) { res.send('Error: ' + err.message); }
});

router.post('/admin/chapter/:chapterId/update', requireLogin, requireAdmin, async (req, res) => {
    const { title, content, publish_now, publish_date } = req.body;
    const finalDate = publish_now ? new Date() : publish_date;
    try {
        const [rows] = await db.query('SELECT novel_id FROM chapters WHERE id = ?', [req.params.chapterId]);
        await db.query('UPDATE chapters SET title = ?, content = ?, publish_date = ? WHERE id = ?', [title, content, finalDate, req.params.chapterId]);
        res.redirect(`/admin/novel/${rows[0].novel_id}/chapters`);
    } catch (err) { res.send('Error: ' + err.message); }
});

router.post('/admin/chapter/:chapterId/delete', requireLogin, requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT novel_id FROM chapters WHERE id = ?', [req.params.chapterId]);
        await db.query('DELETE FROM chapters WHERE id = ?', [req.params.chapterId]);
        res.redirect(`/admin/novel/${rows[0].novel_id}/chapters`);
    } catch (err) { res.send('Error: ' + err.message); }
});

module.exports = router;