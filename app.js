const expressLayouts = require('express-ejs-layouts');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const pool = require('./config/database');
require('dotenv').config();

const app = express();

// puerto que usamos en toda la aplicacion
const PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : 3000;

// ============================================================
// CONFIGURACION DE SEGURIDAD
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CONFIGURACION DE SESIONES
const sessionStore = new MySQLStore({
  expiration: parseInt(process.env.SESSION_MAX_AGE || 7200000),
  endConnectionOnClose: false,
  createDatabaseTable: true,
  schema: {
    tableName: 'express_sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, pool);

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_session_secret_default',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || 7200000)
  }
}));

// Vistas y archivos estaticos
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.use(express.static(path.join(__dirname, 'public')));

// Parseo de cuerpo y cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware global para vistas
app.use((req, res, next) => {
  res.locals.version = process.env.WEB_VERSION;
  res.locals.path = req.path;
  // Priorizar req.user (validación session), luego session user y fallback null
  res.locals.user = req.user || req.session?.user || null;
  next();
});

// Compatibilidad con version cookie-based
app.use((req, res, next) => {
  if (!req.user) {
    const cookies = {};
    const rawCookies = (req.headers.cookie || '').split(';');
    rawCookies.forEach((chunk) => {
      const [key, ...rest] = chunk.split('=');
      if (!key) return;
      const name = key.trim();
      const value = rest.join('=').trim();
      if (!name) return;
      cookies[name] = decodeURIComponent(value || '');
    });

    const cookieRole = cookies.rid_role || 'Administrador';
    const cookieUsername = cookies.rid_user || 'Administrador';
    const userId = cookies.rid_user_id ? Number(cookies.rid_user_id) : null;

    const roleIdMap = {
      'Administrador': 1,
      'Vendedor': 2,
      'Interno': 3,
      'administrador': 1,
      'vendedor': 2,
      'interno': 3
    };

    const role_id = roleIdMap[cookieRole] || 0;

    req.user = {
      id: userId,
      username: cookieUsername,
      name: cookieUsername,
      role_id,
      role: cookieRole,
      is_active: true
    };
    res.locals.user = req.user;
  }
  next();
});

// Rutas API y de vista
//console.log('Mounting API routes at /api');
app.use('/api', require('./routes/api.routes'));
//console.log('Mounting view routes at /');
app.use('/', require('./routes/routes'));
app.use('/tickets', require('./routes/tickets.routes'));
app.use('/ventas', require('./routes/sales.routes'));
app.use('/inventario', require('./routes/inventario.routes'));
app.use('/facturas', require('./routes/facturacion.routes'));
app.use('/clientes', require('./routes/clients.routes'));

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session on GET /logout:', err);
    }
    res.redirect('/');
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Endpoint de API no encontrado' });
  }

  res.status(404).render('404', {
    is404: true
  });
});

app.use((err, req, res, next) => {
  console.error('[ERROR HANDLER] Full error object:', err);
  console.error('[ERROR HANDLER] Message:', err.message);
  console.error('[ERROR HANDLER] Stack:', err.stack);

  if (req.path.startsWith('/api')) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  res.status(500).render('404', {
    message: 'Error interno del servidor',
    is404: true
  });
});

(async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    app.listen(process.env.SERVER_PORT, () => {
      console.log('Localhost: ' + process.env.SERVER_PORT);
    });
  } catch (err) {
    console.error('Conexión a la base de datos falló:', err.message);
  }
})();