function requireRole(requiredRoles) {
  return (req, res, next) => {
    const user = req.user || {};

    // Support string or array input for required roles
    const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    const userRoleName = typeof user.role === 'string' ? user.role.toLowerCase() : null;
    const userRoleId = Number(user.role_id);

    const hasAnyRequiredRole = rolesArray.some((role) => {
      if (typeof role !== 'string') return false;
      const normalized = role.toLowerCase();
      return userRoleName === normalized || (normalized === 'administrador' && userRoleId === 1);
    });

    if (hasAnyRequiredRole) {
      return next();
    }

    console.warn('[requireRole] Acceso denegado. user:', user, 'requiredRoles:', rolesArray);
    return res.status(403).render('403', { message: 'Acceso restringido por rol.' });
  };
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    const permissions = req.user.permissions || {};
    if (permissions[permissionKey]) {
      return next();
    }

    console.warn('[requirePermission] Acceso denegado. user:', req.user.id, 'permission:', permissionKey, 'permissions:', permissions);
    return res.status(403).render('403', { message: 'Acceso restringido por permisos.' });
  };
}

/**
 * Middleware para validar permisos en API (devuelve JSON)
 * Versión API de requirePermission para endpoints que devuelven JSON
 */
function requirePermissionApi(permissionKey, permissionLabel) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'No autorizado',
        code: 'UNAUTHORIZED'
      });
    }

    const permissions = req.user.permissions || {};
    if (permissions[permissionKey]) {
      return next();
    }

    console.warn('[requirePermissionApi] Access denied. user:', req.user.id, 'permission:', permissionKey, 'label:', permissionLabel);
    
    return res.status(403).json({ 
      success: false,
      message: `No cuentas con el permiso "${permissionLabel}" para realizar esta acción`,
      code: 'PERMISSION_DENIED',
      requiredPermission: permissionKey,
      permissionLabel: permissionLabel
    });
  };
}

function requireAdmin(req, res, next) {
  return requireRole(['Administrador', 'administrador', 1])(req, res, next);
}

module.exports = {
  requireRole,
  requireAdmin,
  requirePermission,
  requirePermissionApi
};
