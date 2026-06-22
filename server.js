const db = require('./db');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// Parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup Database Session Store
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

app.use(session({
    key: 'novel_site_session',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Make user info and notifications available to all EJS templates
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.unreadNotifications = 0; // Default to 0
    
    if (req.session.user) {
        try {
            const [notifRows] = await db.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE', [req.session.user.id]);
            res.locals.unreadNotifications = notifRows[0].count;
        } catch (err) {
            console.error('Notif middleware error:', err.message);
        }
    }
    next();
});

// Routes
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

// Novel Routes
const novelRoutes = require('./routes/novels');
app.use('/', novelRoutes);

// Favorites & Profile Routes
const favoriteRoutes = require('./routes/favorites');
const profileRoutes = require('./routes/profile');
const notificationRoutes = require('./routes/notifications');

app.use('/', favoriteRoutes);
app.use('/', profileRoutes);
app.use('/', notificationRoutes);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));