const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/auth.controller');
const { validateSession, requireAdmin, loginRateLimiter, logActivity } = require('../middleware/auth.middleware');
const { requirePermissionApi } = require('../middleware/roles');
const { upload, uploadErrorHandler } = require('../middleware/upload.middleware');

const router = express.Router();

console.log('API routes loaded');

// ============================================================
// VALIDACIONES CON EXPRESS-VALIDATOR
// ============================================================

const loginValidation = [
  body('email').trim().notEmpty().withMessage('Usuario o Email es requerido'),
  body('password').notEmpty().withMessage('Contraseña es requerida')
];

const changePassValidation = [
  body('oldPassword').notEmpty().withMessage('Contraseña actual es requerida'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Nueva contraseña debe tener mínimo 8 caracteres')
    .matches(/[A-Z]/).withMessage('Nueva contraseña debe contener al menos una mayúscula')
    .matches(/[a-z]/).withMessage('Nueva contraseña debe contener al menos una minúscula')
    .matches(/\d/).withMessage('Nueva contraseña debe contener al menos un número')
];

const createUserValidation = [
  body('name').notEmpty().withMessage('Nombre es requerido').isLength({ min: 1 }).withMessage('Nombre debe tener al menos 1 carácter'),
  body('last_name').notEmpty().withMessage('Apellido es requerido').isLength({ min: 1 }).withMessage('Apellido debe tener al menos 1 carácter'),
  body('username').isLength({ min: 3 }).withMessage('Username debe tener mínimo 3 caracteres').notEmpty(),
  body('email').isEmail().withMessage('Email debe ser válido').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Contraseña debe tener mínimo 8 caracteres'),
  body('roleId').isInt().withMessage('Role ID debe ser un número entero')
];

const resetPasswordValidation = [
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Nueva contraseña debe tener mínimo 8 caracteres')
    .matches(/[A-Z]/).withMessage('Nueva contraseña debe contener al menos una mayúscula')
    .matches(/[a-z]/).withMessage('Nueva contraseña debe contener al menos una minúscula')
    .matches(/\d/).withMessage('Nueva contraseña debe contener al menos un número')
];

const resetPasswordTokenValidation = [
  body('token').notEmpty().withMessage('Token es requerido'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Nueva contraseña debe tener mínimo 8 caracteres')
    .matches(/[A-Z]/).withMessage('Nueva contraseña debe contener al menos una mayúscula')
    .matches(/[a-z]/).withMessage('Nueva contraseña debe contener al menos una minúscula')
    .matches(/\d/).withMessage('Nueva contraseña debe contener al menos un número')
];

const passwordResetRequestValidation = [
  body('email').isEmail().withMessage('Email debe ser válido').normalizeEmail()
];

// ============================================================
// RUTAS DE AUTENTICACIÓN - PÚBLICAS
// ============================================================

/**
 * POST /api/auth/login
 * Login con email/username y contraseña
 * Bloqueo manual de cuenta después de 5 intentos fallidos (en auth.service.js)
 */
console.log('Setting up /auth/login route');
router.post(
  '/auth/login',
  loginValidation,
  AuthController.login
);

/**
 * GET /api/auth/verify-email
 * Verifica email de usuario con token
 * Query param: token
 */
router.get(
  '/auth/verify-email',
  AuthController.verifyEmail
);

/**
 * POST /api/auth/request-password-reset
 * Solicita recuperación de contraseña por email
 */
router.post(
  '/auth/request-password-reset',
  passwordResetRequestValidation,
  AuthController.requestPasswordReset
);

/**
 * POST /api/auth/reset-password
 * Resetea contraseña con token válido
 */
router.post(
  '/auth/reset-password',
  resetPasswordTokenValidation,
  AuthController.resetPassword
);

// ============================================================
// RUTAS DE AUTENTICACIÓN - PROTEGIDAS (Requieren sesión)
// ============================================================

/**
 * POST /api/auth/logout
 * Cierra la sesión del usuario actual
 * Protegido - requiere sesión activa
 */
router.post(
  '/auth/logout',
  validateSession,
  logActivity,
  AuthController.logout
);

/**
 * GET /api/auth/profile
 * Obtiene el perfil del usuario autenticado
 */
router.get(
  '/auth/profile',
  validateSession,
  logActivity,
  AuthController.profile
);

/**
 * POST /api/auth/change-password
 * Cambia la contraseña del usuario actual
 * Requiere permiso: cambiarContrasenas
 */
router.post(
  '/auth/change-password',
  validateSession,
  requirePermissionApi('cambiarContrasenas', 'Cambiar Contraseñas'),
  changePassValidation,
  logActivity,
  AuthController.changePassword
);

/**
 * PUT /api/auth/profile
 * Actualiza la información de perfil del usuario autenticado (con soporte para imagen)
 */
router.put(
  '/auth/profile',
  validateSession,
  upload.single('profileImage'),
  uploadErrorHandler,
  logActivity,
  AuthController.updateProfile
);

/**
 * POST /api/auth/profile-image
 * Actualiza solo la imagen de perfil del usuario autenticado
 * Requiere archivo: profileImage (jpg, jpeg, png, máx 5MB)
 */
router.post(
  '/auth/profile-image',
  validateSession,
  upload.single('profileImage'),
  uploadErrorHandler,
  logActivity,
  AuthController.updateProfileImage
);

/**
 * POST /api/admin/users/:userId/profile-image
 * Actualiza la imagen de perfil de cualquier usuario (solo Admins)
 * Requiere archivo: profileImage (jpg, jpeg, png, máx 5MB)
 */
router.post(
  '/admin/users/:userId/profile-image',
  validateSession,
  upload.single('profileImage'),
  uploadErrorHandler,
  logActivity,
  AuthController.updateUserProfileImage
);

/**
 * POST /api/auth/resend-verification-email
 * Reenvia el email de verificación (solo para Admins sin verificar)
 */
router.post(
  '/auth/resend-verification-email',
  validateSession,
  logActivity,
  AuthController.resendVerificationEmail
);

// ============================================================
// RUTAS DE ADMINISTRACIÓN - PROTEGIDAS (Solo Admins)
// ============================================================

/**
 * POST /api/admin/users
 * Crea un nuevo usuario (Admin o Empleado)
 * Solo accesible para administradores
 * Soporta archivo opcional: profileImage (jpg, jpeg, png, máx 5MB)
 */
router.post(
  '/admin/users',
  validateSession,
  requirePermissionApi('crearUsuarios', 'Crear usuarios'),
  upload.single('profileImage'),
  uploadErrorHandler,
  createUserValidation,
  logActivity,
  AuthController.createUser
);

/**
 * DELETE /api/admin/users/:userId
 * Elimina un usuario del sistema
 * Solo accesible para administradores
 */
router.delete(
  '/admin/users/:userId',
  validateSession,
  requirePermissionApi('eliminarUsuarios', 'Eliminar usuarios'),
  logActivity,
  AuthController.deleteUser
);

/**
 * PUT /api/admin/users/:userId/reset-password
 * Resetea la contraseña de un empleado
 * Solo accesible para administradores
 */
router.put(
  '/admin/users/:userId/reset-password',
  validateSession,
  requirePermissionApi('cambiarContrasenas', 'Cambiar Contraseñas'),
  resetPasswordValidation,
  logActivity,
  AuthController.resetEmployeePassword
);

/**
 * PUT /api/admin/users/:userId/status
 * Activa o desactiva una cuenta de usuario
 */
router.put(
  '/admin/users/:userId/status',
  validateSession,
  requirePermissionApi('eliminarUsuarios', 'Cambiar estado de usuarios'),
  logActivity,
  AuthController.updateUserStatus
);

/**
 * POST /api/admin/users/:userId/permissions
 * Guarda permisos seleccionados para usuario
 * Requiere: admin + consultarPermisos
 */
router.post(
  '/admin/users/:userId/permissions',
  validateSession,
  requirePermissionApi('crearUsuarios', 'Editar permisos de usuarios'),
  logActivity,
  AuthController.updateUserPermissions
);

/**
 * GET /api/admin/activity-logs
 * Obtiene los logs de actividad de usuarios
 * Query params: userId, module, startDate, endDate
 * Solo accesible para administradores
 */
router.get(
  '/admin/activity-logs',
  validateSession,
  requireAdmin,
  logActivity,
  AuthController.getActivityLogs
);

// ============================================================
// ENDPOINTS DE PRUEBA
// ============================================================

/**
 * GET /api/test/public
 * Endpoint público para verificar que el servidor está funcionando
 */
router.get('/test/public', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Endpoint público accesible',
    timestamp: new Date()
  });
});

/**
 * GET /api/test/protected
 * Endpoint protegido que requiere sesión válida
 */
router.get('/test/protected', validateSession, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Endpoint protegido - Sesión válida',
    user: req.user,
    timestamp: new Date()
  });
});

/**
 * GET /api/test/admin-only
 * Endpoint solo para administradores
 */
router.get('/test/admin-only', validateSession, requireAdmin, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Endpoint solo admin accedido',
    user: req.user,
    timestamp: new Date()
  });
});

/**
 * PUT /api/usuarios/editar-informacion
 * Actualiza la información básica de un usuario (solo admin)
 * Campos: username, email, phone, role_id
 */
router.put(
  '/usuarios/editar-informacion',
  validateSession,
  requirePermissionApi('crearUsuarios', 'Editar información de usuarios'),
  logActivity,
  (req, res, next) => {
    const updateUserValidation = [
      body('username').isLength({ min: 3 }).withMessage('Username debe tener mínimo 3 caracteres'),
      body('email').isEmail().withMessage('Email debe ser válido').normalizeEmail(),
      body('phone').optional({ checkFalsy: true }).isString().withMessage('Teléfono debe ser válido'),
      body('role_id').isInt({ min: 1 }).withMessage('Rol ID debe ser un número válido'),
      body('userId').isInt().withMessage('User ID debe ser un número')
    ];
    
    // Ejecutar validaciones
    Promise.all(updateUserValidation.map(validation => validation.run(req)))
      .then(() => {
        const { validationResult } = require('express-validator');
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, message: 'Datos inválidos', errors: errors.array() });
        }
        next();
      });
  },
  AuthController.editUserInformation
);

/**
 * PUT /api/usuarios/cambiar-estado
 * Cambia el estado activo/inactivo de un usuario
 */
router.put(
  '/usuarios/cambiar-estado',
  validateSession,
  requirePermissionApi('eliminarUsuarios', 'Cambiar estado de usuarios'),
  logActivity,
  (req, res, next) => {
    const changeStatusValidation = [
      body('userId').isInt().withMessage('User ID debe ser un número'),
      body('is_active').isBoolean().withMessage('Estado debe ser booleano')
    ];
    
    Promise.all(changeStatusValidation.map(validation => validation.run(req)))
      .then(() => {
        const { validationResult } = require('express-validator');
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, message: 'Datos inválidos', errors: errors.array() });
        }
        next();
      });
  },
  AuthController.changeUserStatus
);

/**
 * POST /api/usuarios/cambiar-foto
 * Actualiza la foto de perfil de un usuario
 */
router.post(
  '/usuarios/cambiar-foto',
  validateSession,
  requirePermissionApi('crearUsuarios', 'Cambiar foto de otros usuarios'),
  logActivity,
  upload.single('profileImage'),
  AuthController.changeUserProfileImage
);

/**
 * GET /api/users/export
 * Exporta todos los usuarios a un archivo CSV
 * Solo accesible para administradores con permiso de exportar usuarios
 */
router.get(
  '/users/export',
  validateSession,
  requirePermissionApi('exportarUsuarios', 'Exportar usuarios'),
  logActivity,
  AuthController.exportUsers
);

module.exports = router;