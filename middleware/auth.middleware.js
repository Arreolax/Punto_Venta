const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const AuthService = require('../services/auth.service');

/**
 * Middleware que valida si el usuario tiene una sesión activa
 * y controla la inactividad automática
 */
const validateSession = async (req, res, next) => {
  console.log('validateSession called for:', req.method, req.path);
  // Si no existe sesión o el usuario no está logueado, rechazar
  if (!req.session || !req.session.user) {
    console.log('validateSession: no session or user');
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Sesión no válida. Por favor inicia sesión',
        code: 'NO_SESSION' 
      });
    }
    return res.redirect('/session-expired');
  }

  try {
    // Validar inactividad de sesión
    const lastActivity = req.session.lastActivity;
    const inactivityLimit = parseInt(process.env.SESSION_INACTIVITY_MS || 7200000); // 2h por defecto
    
    if (lastActivity && Date.now() - lastActivity > inactivityLimit) {
      // Sesión expirada por inactividad
      req.session.destroy((err) => {
        if (err) console.error('Error al destruir sesión:', err);
      });
      
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Tu sesión ha expirado por inactividad. Por favor inicia sesión nuevamente',
          code: 'SESSION_EXPIRED' 
        });
      }
      return res.redirect('/session-expired');
    }

    // Actualizar última actividad
    req.session.lastActivity = Date.now();

    // Validar en BD que la sesión siga activa (para el caso de logout en otra pestaña)
    const [sessions] = await pool.query(
      'SELECT is_active, last_activity FROM sessions WHERE user_id = ? AND id = ?',
      [req.session.user.id, req.session.sessionId]
    );

    if (!sessions || !sessions[0] || !sessions[0].is_active) {
      req.session.destroy((err) => {
        if (err) console.error('Error al destruir sesión:', err);
      });
      
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Tu sesión ha sido cerrada. Por favor inicia sesión nuevamente',
          code: 'SESSION_INVALID' 
        });
      }
      return res.redirect('/session-expired');
    }

    // Guardar último acceso real proveniente de DB antes de actualizar
    const lastAccess = sessions[0].last_activity ? new Date(sessions[0].last_activity).toISOString() : null;

    // Actualizar última actividad en BD
    await pool.query(
      'UPDATE sessions SET last_activity = NOW() WHERE id = ?',
      [req.session.sessionId]
    );

    // Asignar usuario a req para acceso en controladores y rutas
    req.user = {
      ...req.session.user,
      lastActivity: lastAccess
    };

    // Refrescar permisos desde BD en cada request para evitar permisos obsoletos en sesión.
    try {
      const perms = await AuthService.getEffectivePermissions(req.user.id);
      req.user.permissions = perms;
      req.session.user.permissions = perms;
    } catch (permErr) {
      console.error('Error cargando permisos en sesión:', permErr);
      req.user.permissions = {};
    }

    // Asegurar que los templates EJS tengan siempre user actualizado
    res.locals.user = req.user;

    next();
  } catch (err) {
    console.error('Error en validación de sesión:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Error en la validación de sesión',
      code: 'SESSION_ERROR' 
    });
  }
};

/**
 * Middleware que verifica si el usuario es Administrador
 * Debe usarse DESPUÉS de validateSession
 */
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'No autorizado' });
  }

  // Verificar si el rol es Administrador (role_id = 1)
  if (req.session.user.role_id !== 1) {
    // difusión de bloqueos y advertencias sobre uso incorrecto
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permisos para esta acción. Contacta a un administrador. Si sigues persistiendo se suspenderá tu cuenta indefinidamente.',
        code: 'FORBIDDEN' 
      });
    }

    const redirMessage = encodeURIComponent('forbidden');
    return res.redirect('/perfil?warning=' + redirMessage);
  }

  next();
};

/**
 * Middleware de rate limiting para intentos de login
 * Protege contra fuerza bruta
 */
const loginRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '1800000'), // 30 minutos por defecto
  max: parseInt(process.env.RATE_LIMIT_MAX || '5'), // máximo 5 intentos
  keyGenerator: (req) => {
    // Usar email como clave si está disponible, sino usar IP con helper seguro para IPv6
    if (req.body && req.body.email) {
      return req.body.email;
    }
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown_ip';
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de login. Intenta de nuevo en 30 minutos',
      code: 'TOO_MANY_ATTEMPTS',
      retryAfter: 1800
    });
  },
  skip: (req) => !req.path.includes('/login')
});

/**
 * Middleware que registra actividades de usuarios en la tabla activity_logs
 * Se ejecuta después de validar la sesión
 */
const logActivity = async (req, res, next) => {
  const userId = req.user?.id || req.session?.user?.id || null;

  if (userId) {
    // Registrar actividad de forma asíncrona sin bloquear la respuesta
    setImmediate(async () => {
      try {
        const action = extractActionFromRequest(req);
        const module = extractModuleFromRequest(req);
        
        await pool.query(
          'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
          [userId, action, module, JSON.stringify({
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('user-agent')
          })]
        );
      } catch (err) {
        console.error('Error al registrar actividad:', err);
      }
    });
  }
  next();
};

/**
 * Extrae la acción realizada basada en la ruta y método HTTP
 */
function extractActionFromRequest(req) {
  const path = req.path;
  const method = req.method;

  if (path === '/auth/login' && method === 'POST') return 'login';
  if (path === '/auth/logout' && method === 'POST') return 'logout';
  if (path === '/auth/change-password' && method === 'POST') return 'change_password';
  if (path.includes('/perfil') && method === 'GET') return 'view_profile';
  if (path.includes('/admin/users') && method === 'POST') return 'create_user';
  if (path.includes('/admin/users') && method === 'DELETE') return 'delete_user';
  if (path.includes('/admin/users') && method === 'PUT') return 'update_user';
  if (path.includes('/inventario/movimientos') && method === 'POST' && path.includes('/delete')) return 'inventory_movement_delete';
  if (path.includes('/inventario/movimientos') && method === 'POST') return 'inventory_movement_create';

  return 'unknown_action';
}

/**
 * Extrae el módulo basado en la ruta
 */
function extractModuleFromRequest(req) {
  const path = req.path;
  
  if (path.includes('/auth')) return 'auth';
  if (path.includes('/admin')) return 'admin';
  if (path.includes('/perfil')) return 'profile';
  if (path.includes('/inventario')) return 'inventory';
  
  return 'general';
}

module.exports = { validateSession, requireAdmin, loginRateLimiter, logActivity };
