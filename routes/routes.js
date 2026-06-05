const express = require('express');
const AuthService = require('../services/auth.service');
const { validateSession, logActivity } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/roles');
const router = express.Router();
const { dashboardView } = require('../controllers/dashboard.controller');

let resolveUserThemeStyles = () => ({});
let getThemeOptions = () => [];
try {
  const userTheme = require('../config/user-theme');
  resolveUserThemeStyles = userTheme.resolveUserThemeStyles || resolveUserThemeStyles;
  getThemeOptions = userTheme.getThemeOptions || getThemeOptions;
} catch (error) {
  console.warn('[ROUTES] config/user-theme no disponible, se usarán estilos por defecto');
}

/**
 * Middleware para asignar layouts según la ruta
 */
router.use((req, res, next) => {
  if (
    req.path === '/' ||
    req.path.startsWith('/login') ||
    req.path === '/recuperar' ||
    req.path === '/reset-password'
  ) {
    res.locals.layout = 'layouts/auth';
  } else {
    res.locals.layout = 'layouts/header-menu';
  }
  next();
});

/**
 * GET /
 * Login
 */
router.get('/', (req, res) => {
  if (req.session?.user) {
    return res.redirect('/dashboard');
  }
  res.render('index');
});

router.get('/dashboard', validateSession, dashboardView);

router.get('/creacion', validateSession, requirePermission('crearUsuarios'), (req, res) => {
  res.render('usuarios/creacion', { layout: 'layouts/header-menu', user: req.user });
});

router.get('/permisos', validateSession, logActivity, async (req, res) => {
  try {
    const targetUserId = req.query.userId ? parseInt(req.query.userId, 10) : null;
    const hasConsultarPermisos = Boolean(req.user.permissions && req.user.permissions.consultarPermisos);
    const hasCrearUsuarios = Boolean(req.user.permissions && req.user.permissions.crearUsuarios);

    if (targetUserId && targetUserId !== req.user.id && !hasConsultarPermisos && !hasCrearUsuarios) {
      return res.status(403).render('403', {
        message: 'No tienes permiso para ver los permisos de otros usuarios',
        layout: false
      });
    }

    console.log('[PERMISOS] Query params:', req.query);
    console.log('[PERMISOS] targetUserId parsed:', targetUserId);
    let targetUser = null;

    if (targetUserId) {
      console.log('[PERMISOS] Fetching user by ID:', targetUserId);
      targetUser = await AuthService.getUserById(targetUserId);
      console.log('[PERMISOS] targetUser found:', targetUser);
      if (!targetUser) {
        return res.status(404).render('404', { message: 'Usuario no encontrado', layout: false });
      }
    } else {
      console.log('[PERMISOS] Using current user ID:', req.user.id);
      targetUser = await AuthService.getUserById(req.user.id);
      console.log('[PERMISOS] current targetUser:', targetUser);
      if (!targetUser) {
        return res.status(404).render('404', { message: 'Usuario no encontrado', layout: false });
      }
    }

    const isVendor = req.user && req.user.role_id === 2;
    const targetRoleId = (targetUser && typeof targetUser.role_id !== 'undefined') ? targetUser.role_id : ((req.user && req.user.role_id) ? req.user.role_id : 1);

    const roleDefaults = {
      1: { consultarOtrosUsuarios: true, consultarPermisos: true, crearUsuarios: true, cambiarContrasenas: true, eliminarUsuarios: true, exportarUsuarios: true, consultarStocks: true, consultarMovimientosStock: true, crearAlmacenes: true, verInventarios: true, eliminarAlmacenes: true, eliminarInventario: true, registrarMovimientos: true, eliminarMovimientos: true, exportarReportes: true, importarDatos: true, impresionDirecta: true, impresoraTickets: true, leerMargenes: true, definirMargenes: true, lanzarImportaciones: true, obtenerResultadoExportacion: true, crearEditarExportaciones: true },
      2: { consultarOtrosUsuarios: true, consultarPermisos: false, crearUsuarios: false, cambiarContrasenas: false, eliminarUsuarios: false, exportarUsuarios: false, consultarStocks: true, consultarMovimientosStock: true, crearAlmacenes: false, verInventarios: true, eliminarAlmacenes: false, eliminarInventario: true, registrarMovimientos: true, eliminarMovimientos: false, exportarReportes: false, importarDatos: false, impresionDirecta: false, impresoraTickets: false, leerMargenes: false, definirMargenes: false, lanzarImportaciones: false, obtenerResultadoExportacion: false, crearEditarExportaciones: false },
      3: { consultarOtrosUsuarios: true, consultarPermisos: false, crearUsuarios: false, cambiarContrasenas: false, eliminarUsuarios: false, exportarUsuarios: false, consultarStocks: true, consultarMovimientosStock: true, crearAlmacenes: false, verInventarios: true, eliminarAlmacenes: false, eliminarInventario: false, registrarMovimientos: false, eliminarMovimientos: false, exportarReportes: false, importarDatos: false, impresionDirecta: false, impresoraTickets: false, leerMargenes: false, definirMargenes: false, lanzarImportaciones: false, obtenerResultadoExportacion: false, crearEditarExportaciones: false }
    };

    const isSelfView = !targetUserId || (targetUser && targetUser.id === req.user.id);
    const isEditable = hasCrearUsuarios && !isSelfView;
    const canToggleStatus = Boolean(req.user.permissions && req.user.permissions.eliminarUsuarios) && !isSelfView;

    let targetPermissions = roleDefaults[targetRoleId] || roleDefaults[1];

    try {
      if (targetUser && targetUser.id) {
        const effectivePerms = await AuthService.getEffectivePermissions(targetUser.id);
        if (effectivePerms && Object.keys(effectivePerms).length > 0) {
          targetPermissions = { ...targetPermissions, ...effectivePerms };
        }
      }
    } catch (permErr) {
      console.error('[PERMISOS] Error obteniendo permisos efectivos:', permErr);
    }

    res.render('usuarios/permisos', {
      user: req.user,
      targetUser,
      targetUserId,
      isVendor,
      isSelfView,
      isEditable,
      canToggleStatus,
      targetPermissions,
      layout: 'layouts/header-menu'
    });
  } catch (err) {
    console.error('[PERMISOS] Error interno:', err.message, err.stack);
    return res.status(500).render('404', { message: 'Error interno al cargar permisos', layout: false });
  }
});

router.get('/usuarios', validateSession, logActivity, async (req, res, next) => {
  try {
    const isAdmin = req.user.role_id === 1;
    const hasViewUsersPermission = req.user.permissions && req.user.permissions.consultarOtrosUsuarios;

    if (!isAdmin && !hasViewUsersPermission) {
      return res.status(403).render('404', {
        message: 'Acceso denegado: No tienes permiso para ver otros usuarios',
        layout: false
      });
    }

    const requestedPage = parseInt(req.query.page || '1', 10);
    const page = Number.isNaN(requestedPage) ? 1 : Math.max(1, requestedPage);
    const allowedPageSizes = [10, 25, 50, 100];
    const requestedPageSize = parseInt(req.query.pageSize || '10', 10);
    const pageSize = allowedPageSizes.includes(requestedPageSize) ? requestedPageSize : 10;
    const filters = {
      search: (req.query.search || '').trim(),
      role: (req.query.role || '').trim().toLowerCase(),
      status: (req.query.status || '').trim().toLowerCase()
    };
    const { users, total } = await AuthService.getUsers(page, pageSize, filters);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    res.render('usuarios/users', {
      layout: 'layouts/header-menu',
      user: req.user,
      users,
      totalUsers: total,
      currentPage: page,
      pageSize,
      totalPages,
      filters,
      permissions: req.user.permissions || {}
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', (req, res) => {
  res.redirect('/usuarios');
});

/**
 * GET /perfil
 */
router.get(
  '/perfil',
  validateSession,
  logActivity,
  async (req, res) => {
    const warning = req.query.warning || null;
    let perfilUser = req.user;

    try {
      const dbUser = await AuthService.getUserById(req.user.id);
      if (dbUser) {
        perfilUser = { ...perfilUser, ...dbUser };
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }

    res.render('usuarios/perfil', {
      user: perfilUser,
      userTheme: resolveUserThemeStyles(perfilUser),
      themeOptions: getThemeOptions(),
      warning,
      layout: 'layouts/header-menu'
    });
  }
);

/**
 * 🔥 GET /perfil/editar (NUEVO)
 */
router.get(
  '/perfil/editar',
  validateSession,
  logActivity,
  async (req, res) => {
    let perfilUser = req.user;

    try {
      const dbUser = await AuthService.getUserById(req.user.id);
      if (dbUser) {
        perfilUser = { ...perfilUser, ...dbUser };
      }
    } catch (err) {
      console.error('Error loading edit profile:', err);
    }

    res.render('usuarios/editarPerfil', {
      user: perfilUser,
      layout: 'layouts/header-menu'
    });
  }
);

/**
 * OST /perfil/editar (NUEVO)
 */
router.post(
  '/perfil/editar',
  validateSession,
  logActivity,
  async (req, res) => {
    const { username, email, phone, name, last_name, position, salary, birthdate } = req.body;

    try {
      await AuthService.updateProfile(req.user.id, {
        username,
        email,
        phone,
        name,
        last_name,
        position,
        salary: salary ? Number(salary) : null,
        birthdate: birthdate || null
      });

      res.redirect('/perfil');
    } catch (err) {
      console.error('Error updating profile:', err);

      res.render('usuarios/editarPerfil', {
        user: { ...req.user, ...req.body },
        errorMessage: 'Error al actualizar el perfil',
        layout: 'layouts/header-menu'
      });
    }
  }
);

/**
 * GET /recuperar
 */
router.get('/recuperar', (req, res) => {
  res.render('usuarios/recuperar', { layout: false });
});

/**
 * GET /session-expired
 */
router.get('/session-expired', (req, res) => {
  res.render('usuarios/no-session', { layout: false });
});

/**
 * GET /reset-password
 */
router.get('/reset-password', (req, res) => {
  res.render('usuarios/reset-password', { layout: false });
});

/**
 * GET /verify-email
 * Verifica el email del usuario usando token
 * Público - sin autenticación requerida
 */
router.get('/verify-email', (req, res) => {
  res.render('usuarios/verify-email', { layout: false });
});

/**
 * GET /admin/activity-logs
 */
router.get(
  '/admin/activity-logs',
  validateSession,
  logActivity,
  (req, res) => {
    if (req.user.role_id !== 1) {
      return res.status(403).render('404', {
        message: 'Acceso denegado: Solo administradores'
      });
    }

    res.render('admin/activity-logs', {
      user: req.user,
      layout: 'layouts/header-menu'
    });
  }
);

module.exports = router;
