const { validationResult } = require('express-validator');
const AuthService = require('../services/auth.service');
const LoggerService = require('../services/logger.service');
const { deleteOldImage } = require('../middleware/upload.middleware');
const { name } = require('ejs');

class AuthController {
  /**
   * Controlador de Login
   * POST /api/auth/login
   * 
   * Autentica un usuario por email/username y contraseña
   * Crea una sesión express-session si las credenciales son válidas
   */
  static async login(req, res, next) {
    try {
      LoggerService.auth('Login attempt started');
      
      // Validar errores de express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        LoggerService.auth('Validation errors', null, errors.array());
        return res.status(400).json({ 
          success: false, 
          message: 'Datos de entrada inválidos',
          errors: errors.array() 
        });
      }

      const { email: emailOrUsername, password } = req.body;
      LoggerService.auth(`Login attempt for: ${emailOrUsername}`);
      
      // Detectar si es email o username
      const isEmail = emailOrUsername.includes('@');
      const loginType = isEmail ? 'email' : 'username';

      // Validar credenciales contra BD
      const user = await AuthService.loginUser(emailOrUsername, password);
      LoggerService.auth(`User authenticated: ${user.id}`, emailOrUsername);

      // Crear sesión express-session
      LoggerService.auth(`Creating session for user: ${user.id}`, emailOrUsername);
      req.session.user = {
        id: user.id,
        name: user.name,
        last_name: user.last_name,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        profile_image_path: user.profile_image_path || null
      };
      req.session.sessionId = user.sessionId;
      req.session.lastActivity = Date.now();
      LoggerService.auth('Session object created', emailOrUsername);

      // Guardar sesión
      req.session.save((err) => {
        if (err) {
          LoggerService.error('Session save error', 'auth', { error: err.message, emailOrUsername });
          return res.status(500).json({ 
            success: false, 
            message: 'Error al crear la sesión'
          });
        }

        LoggerService.auth(`Login successful for user: ${user.id}`, emailOrUsername);
        console.log('[AuthController.login] Sesión guardada - user:', req.session.user, 'sessionId:', req.session.sessionId);

        res.json({ 
          success: true, 
          message: 'Inicio de sesión exitoso',
          data: { 
            user: {
              id: user.id,
              name: user.name,
              last_name: user.last_name,
              username: user.username,
              email: user.email,
              role_id: user.role_id,
              profile_image_path: user.profile_image_path || null
            }
          }
        });
      });
    } catch (err) {
      LoggerService.error(`Login error: ${err.message}`, 'auth', { stack: err.stack });

      // Detectar tipo de entrada del body para mensaje personalizado
      const emailOrUsername = req.body?.email || '';
      const isEmail = emailOrUsername.includes('@');
      const errorMessage = isEmail ? 'Correo o Contraseña Inválidos' : 'Nombre de usuario o contraseña incorrectos';

      // Si es error de credenciales, mostrar mensaje apropiado basado en tipo de entrada
      if (err.message && err.message.includes('Correo o contraseña')) {
        return res.status(401).json({ success: false, message: errorMessage });
      }

      const safeMessages = [
        'Cuenta inactiva',
        'Cuenta bloqueada por seguridad. Intenta de nuevo en 30 minutos',
        'Cuenta bloqueada por seguridad. Intenta de nuevo en',
        'Cuenta bloqueada temporalmente. Tiempo restante:',
        'Cuenta de administrador no verificada. Por favor verifica tu email',
        'Múltiples intentos fallidos. Se ha enviado una alerta a tu correo electrónico',
        'Demasiados intentos de inicio de sesión'
      ];

      // Para otros errores controlados, retornar como están
      if (typeof err.message === 'string' && safeMessages.some(msg => err.message.startsWith(msg))) {
        return res.status(401).json({ success: false, message: err.message });
      }

      // Para otros errores que no sean de credenciales, devolver 500 de forma controlada
      return res.status(500).json({ success: false, message: 'Error interno del servidor en login' });
    }
  }

  /**
   * Controlador de Logout
   * POST /api/auth/logout
   * Protegido: requiere sesión activa
   * 
   * Cierra la sesión del usuario actual
   */
  static async logout(req, res, next) {
    try {
      const userId = req.session?.user?.id;
      const sessionId = req.session?.sessionId;

      // Registrar logout en BD si hay datos de sesión
      if (userId && sessionId) {
        await AuthService.logoutUser(userId, sessionId);
      }

      // Destruir sesión de express-session
      req.session.destroy((err) => {
        if (err) {
          console.error('Error al destruir sesión:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Error al cerrar la sesión'
          });
        }

        // Limpiar cookie de sesión
        res.clearCookie('connect.sid');
        res.json({ 
          success: true, 
          message: 'Cierre de Sesión Exitoso'
        });
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador de Perfil
   * GET /api/auth/profile
   * Protegido: requiere sesión activa
   * 
   * Devuelve los datos del usuario autenticado INCLUYENDO campos de perfil
   */
  static async profile(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'No hay usuario en la sesión'
        });
      }

      const userId = req.user.id;
      
      // Obtener datos completos del usuario incluyendo campos de perfil desde BD
      const userComplete = await AuthService.getUserById(userId);
      
      if (!userComplete) {
        return res.status(404).json({ 
          success: false, 
          message: 'Usuario no encontrado'
        });
      }

      res.json({ 
        success: true, 
        message: 'Perfil obtenido',
        data: { 
          user: {
            id: userComplete.id,
            username: userComplete.username,
            email: userComplete.email,
            phone: userComplete.phone || null,
            role_id: userComplete.role_id,
            is_active: userComplete.is_active,
            job_position: userComplete.job_position || null,
            birth_date: userComplete.birth_date || null,
            profile_image_path: userComplete.profile_image_path || null,
            created_at: userComplete.created_at
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador de actualización de perfil
   * PUT /api/auth/profile
   * Permite actualizar datos del perfil incluyendo campos opcionales e imagen
   */
  static async updateProfile(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'No autorizado'
        });
      }

      const { username, email, phone, jobPosition, birthDate } = req.body;
      if (!username || username.trim().length < 3) {
        return res.status(400).json({ success: false, message: 'El nombre de usuario debe tener mínimo 3 caracteres' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Email inválido' });
      }

      let profileImagePath = null;
      if (req.file) {
        profileImagePath = `/images/users/${req.file.filename}`;
      }

      const result = await AuthService.updateProfile(userId, { 
        username: username.trim(), 
        email: email.trim(), 
        phone: (phone || '').trim(),
        jobPosition: jobPosition || null,
        birthDate: birthDate || null,
        profileImagePath: profileImagePath
      });

      // actualizar user en sesión
      req.session.user = {
        ...req.session.user,
        username: result.username,
        email: result.email,
        profile_image_path: result.profile_image_path || null
      };

      res.json({ success: true, message: 'Perfil actualizado correctamente', data: result });
    } catch (err) {
      // Eliminar imagen si actualización falló
      if (req.file) {
        deleteOldImage(`/images/users/${req.file.filename}`);
      }
      next(err);
    }
  }

  /**
   * Controlador para actualizar solo la imagen de perfil
   * POST /api/auth/profile-image
   * Protegido: requiere sesión activa
   * 
   * Permite cambiar solo la imagen de perfil del usuario autenticado
   */
  static async updateProfileImage(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'No autorizado'
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'Archivo de imagen requerido'
        });
      }

      const profileImagePath = `/images/users/${req.file.filename}`;
      const result = await AuthService.updateProfileImage(userId, profileImagePath);

      // Actualizar sesión
      req.session.user = {
        ...req.session.user,
        profile_image_path: result.profile_image_path
      };

      res.json({ 
        success: true, 
        message: 'Imagen de perfil actualizada correctamente', 
        data: result 
      });
    } catch (err) {
      // Eliminar imagen si actualización falló
      if (req.file) {
        deleteOldImage(`/images/users/${req.file.filename}`);
      }
      next(err);
    }
  }

  /**
   * Actualizar imagen de perfil de cualquier usuario (solo Admins)
   * POST /api/admin/users/:userId/profile-image
   */
  static async updateUserProfileImage(req, res, next) {
    try {
      const adminId = req.user?.id;
      const targetUserId = parseInt(req.params.userId, 10);
      
      // Validar que el usuario actual es admin
      if (req.user?.role_id !== 1) {
        return res.status(403).json({ 
          success: false, 
          message: 'Solo los administradores pueden actualizar imágenes de otros usuarios'
        });
      }

      if (!targetUserId) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de usuario requerido'
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'Archivo de imagen requerido'
        });
      }

      // Verificar que el usuario existe
      const user = await AuthService.getUserById(targetUserId);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'Usuario no encontrado'
        });
      }

      const profileImagePath = `/images/users/${req.file.filename}`;
      const result = await AuthService.updateProfileImage(targetUserId, profileImagePath);

      res.json({ 
        success: true, 
        message: 'Imagen de perfil del usuario actualizada correctamente', 
        data: result 
      });
    } catch (err) {
      // Eliminar imagen si actualización falló
      if (req.file) {
        deleteOldImage(`/images/users/${req.file.filename}`);
      }
      next(err);
    }
  }

  /**
   * Controlador de Cambio de Contraseña
   * POST /api/auth/change-password
   * Protegido: requiere sesión activa
   * 
   * Permite que el usuario cambie su propia contraseña
   */
  static async changePassword(req, res, next) {
    try {
      // Validar errores de express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Datos de entrada inválidos',
          errors: errors.array() 
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'No autorizado'
        });
      }

      const { oldPassword, newPassword } = req.body;

      // Cambiar contraseña en BD
      await AuthService.changePassword(userId, oldPassword, newPassword);

      res.json({ 
        success: true, 
        message: 'Contraseña actualizada correctamente'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para Crear Usuario
   * POST /api/admin/users
   * Protegido: solo administradores
   * 
   * Permite crear un nuevo usuario (Admin o Empleado)
   * Campos opcionalmente aceptados para perfil: jobPosition, birthDate
   */
  static async createUser(req, res, next) {
    try {
      // Validar errores de express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Datos de entrada inválidos',
          errors: errors.array() 
        });
      }

      const { username, name, last_name, email, password, roleId, jobPosition, birthDate, phone } = req.body;
      let profileImagePath = null;

      // Procesar imagen si existe
      if (req.file) {
        // Guardar ruta relativa como: /images/users/filename.jpg
        profileImagePath = `/images/users/${req.file.filename}`;
      }

      console.log(`[CreateUser] Iniciando creación: ${username} (roleId: ${roleId}) con imagen: ${profileImagePath || 'sin imagen'}`);
      console.log(`[CreateUser_BEFORE_CALL] About to call AuthService.createUser with params: username=${username}, name=${name}, last_name=${last_name}, email=${email}, roleId=${roleId}, jobPosition=${jobPosition}, birthDate=${birthDate}, phone=${phone}, profileImagePath=${profileImagePath}`);
      console.log(`[CreateUser_BEFORE_CALL] AuthService object:`, typeof AuthService, AuthService.createUser ? 'createUser exists' : 'createUser NOT found');

      // Crear usuario en BD con campos de perfil opcionales e imagen
      const result = await AuthService.createUser(
        username, 
        name || null,
        last_name || null,
        email, 
        password, 
        roleId,
        jobPosition || null,
        birthDate || null,
        phone || null,
        profileImagePath
      );
      console.log(`[CreateUser_AFTER_CALL] Got result from service:`, typeof result, result ? '(success)' : '(null/undefined)');
      console.log(`[CreateUser] Usuario creado: ${result.id || username}`);

      // El service retorna éxito, respondemos 201
      res.status(201).json({ 
        success: true, 
        message: result.message,
        data: result
      });
    } catch (err) {
      console.error(`[CreateUser] Error:`, err.message);
      
      // Eliminar imagen si creación falló
      if (req.file) {
        deleteOldImage(`/images/users/${req.file.filename}`);
      }
      
      // Determinar status code según tipo de error
      const statusCode = err.message.includes('El usuario o email ya existe') || 
                        err.message.includes('Rol inválido') ||
                        err.message.includes('Duplicate entry') ||
                        err.message.includes('debe ser') ||
                        err.message.includes('debe estar')
        ? 400
        : 500;

      // Mapear mensaje amigable para errores de duplicado
      let userMessage = err.message;
      if (err.message.includes('Duplicate entry') && err.message.includes('username')) {
        userMessage = 'El nombre de usuario ya está registrado';
      } else if (err.message.includes('Duplicate entry') && err.message.includes('email')) {
        userMessage = 'El email ya está registrado';
      }

      res.status(statusCode).json({ 
        success: false, 
        message: userMessage || 'Error al crear usuario'
      });
    }
  }

  /**
   * Controlador para Eliminar Usuario
   * DELETE /api/admin/users/:userId
   * Protegido: solo administradores
   * 
   * Elimina un usuario del sistema
   */
  static async deleteUser(req, res, next) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de usuario requerido'
        });
      }

      // Eliminar usuario de BD
      const result = await AuthService.deleteUser(userId);

      res.json({ 
        success: true, 
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para Resetear Contraseña de Empleado
   * PUT /api/admin/users/:userId/reset-password
   * Protegido: solo administradores
   * 
   * Permite al admin cambiar la contraseña de un empleado
   */
  static async resetEmployeePassword(req, res, next) {
    try {
      // Validar errores de express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Datos de entrada inválidos',
          errors: errors.array() 
        });
      }

      const { userId } = req.params;
      const { newPassword } = req.body;
      const adminId = req.user?.id;

      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de usuario requerido'
        });
      }

      if (!adminId) {
        return res.status(401).json({ 
          success: false, 
          message: 'No autorizado'
        });
      }

      // Resetear contraseña en BD
      const result = await AuthService.resetEmployeePassword(userId, newPassword, adminId);

      res.json({ 
        success: true, 
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para actualizar estado activo/inactivo de usuario
   * PUT /api/admin/users/:userId/status
   */
  static async updateUserStatus(req, res, next) {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;
      const adminId = req.user?.id;

      if (!userId) {
        return res.status(400).json({ success: false, message: 'ID de usuario requerido' });
      }

      if (adminId == null) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Estado activo/no activo inválido' });
      }

      const result = await AuthService.updateUserStatus(userId, isActive, adminId);

      res.json({ success: true, message: 'Usuario actualizado correctamente', data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para actualizar permisos de usuario
   * POST /api/admin/users/:userId/permissions
   */
  static async updateUserPermissions(req, res, next) {
    try {
      const { userId } = req.params;
      const { permissions } = req.body;

      if (!userId || !permissions || typeof permissions !== 'object') {
        return res.status(400).json({ success: false, message: 'Solicitud inválida' });
      }

      await AuthService.updateUserPermissions(userId, permissions);

      res.json({ success: true, message: 'Permisos de usuario actualizados correctamente', data: { userId, permissions } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para Obtener Logs de Actividad
   * GET /api/admin/activity-logs
   * Protegido: solo administradores
   * 
   * Obtiene los logs de actividad de usuarios con filtros opcionales
   * Query params: userId, module, startDate, endDate
   */
  static async getActivityLogs(req, res, next) {
    try {
      // Construir filtros desde query parameters
      const filters = {
        userId: req.query.userId ? parseInt(req.query.userId) : null,
        module: req.query.module || null,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null
      };

      // Obtener logs con filtros
      const result = await AuthService.getActivityLogs(filters);

      res.json({ 
        success: true, 
        message: 'Logs de actividad obtenidos',
        data: result.data,
        count: result.count
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para Verificar Email
   * POST /api/auth/verify-email
   * Público
   * 
   * Verifica el email de un usuario usando un token de verificación
   */
  static async verifyEmail(req, res, next) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: 'Token de verificación requerido'
        });
      }

      // Verificar token y marcar usuario como verificado
      const result = await AuthService.verifyEmailToken(token);

      res.json({ 
        success: true, 
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para Reenviar Email de Verificación
   * POST /api/auth/resend-verification-email
   * Protegido: requiere sesión activa
   * 
   * Reenvia el email de verificación al usuario actual (solo Admins)
   */
  static async resendVerificationEmail(req, res, next) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'No autorizado'
        });
      }

      // Reenviar email de verificación
      const result = await AuthService.resendVerificationEmail(userId);

      res.json({ 
        success: true, 
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para Solicitar Recuperación de Contraseña
   * POST /api/auth/request-password-reset
   * Público
   * 
   * Genera un token de recuperación y envía email con enlace de reseteo
   */
  static async requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email requerido'
        });
      }

      // Solicitar reseteo de contraseña
      const result = await AuthService.requestPasswordReset(email);

      // Si el flujo devuelve advertencia de negocio, mantener 200 pero marcar warning
      if (result.warning) {
        return res.json({
          success: false,
          warning: true,
          message: result.message
        });
      }

      // Respuesta genérica por seguridad (no confirmar si el email existe)
      res.json({
        success: true,
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para Resetear Contraseña con Token
   * POST /api/auth/reset-password
   * Público
   * 
   * Valida el token de reseteo y actualiza la contraseña
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Token y nueva contraseña son requeridos'
        });
      }

      // Resetear contraseña con token
      const result = await AuthService.resetPasswordWithToken(token, newPassword);

      res.json({ 
        success: true, 
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para Editar Información de Usuario
   * PUT /api/usuarios/editar-informacion
   * Protegido: requiere sesión y permisos de admin
   * 
   * Permite a un admin editar: username, email, phone, role_id de otro usuario
   */
  static async editUserInformation(req, res, next) {
    try {
      const { userId, username, email, phone, role_id } = req.body;

      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de usuario requerido'
        });
      }

      // Validar que no sea a sí mismo
      if (userId === req.user.id) {
        return res.status(400).json({ 
          success: false, 
          message: 'No puedes editar tu propia información desde aquí'
        });
      }

      // Actualizar información del usuario
      const result = await AuthService.editUserInformation(userId, {
        username: username?.trim(),
        email: email?.trim(),
        phone: phone?.trim() || null,
        role_id: parseInt(role_id)
      });

      // Registrar actividad
      const LoggerService = require('../services/logger.service');
      LoggerService.info('Información de usuario editada', 'admin', {
        targetUserId: userId,
        editedBy: req.user.id,
        changes: { username, email, phone, role_id }
      });

      res.json({ 
        success: true, 
        message: 'Información del usuario actualizada correctamente',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cambiar estado (activo/inactivo) de un usuario
   * PUT /api/usuarios/cambiar-estado
   */
  static async changeUserStatus(req, res, next) {
    try {
      const { userId, is_active } = req.body;

      if (!userId || is_active === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: 'Parámetros requeridos no proporcionados'
        });
      }

      if (userId === req.user.id) {
        return res.status(400).json({ 
          success: false, 
          message: 'No puedes cambiar tu propio estado'
        });
      }

      const result = await AuthService.updateUserStatus(userId, is_active);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message || 'No se pudo cambiar el estado'
        });
      }

      const LoggerService = require('../services/logger.service');
      LoggerService.info('Estado de usuario modificado', 'admin', {
        targetUserId: userId,
        editedBy: req.user.id,
        newStatus: is_active ? 'Activo' : 'Inactivo'
      });

      res.json({ 
        success: true, 
        message: `Usuario ${is_active ? 'activado' : 'desactivado'} correctamente`,
        data: result.data
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cambiar foto de perfil de un usuario
   * POST /api/usuarios/cambiar-foto
   */
  static async changeUserProfileImage(req, res, next) {
    try {
      console.log('[changeUserProfileImage] req.body:', req.body);
      console.log('[changeUserProfileImage] req.file:', req.file);
      
      const { userId } = req.body;
      const file = req.file;
      const targetUserId = parseInt(userId, 10);

      console.log('[changeUserProfileImage] userId from body:', userId);
      console.log('[changeUserProfileImage] targetUserId (parsed):', targetUserId);
      console.log('[changeUserProfileImage] file:', file ? `${file.filename} (${file.size} bytes)` : 'NO FILE');

      if (!targetUserId || !file) {
        console.log('[changeUserProfileImage] VALIDATION FAILED - !targetUserId:', !targetUserId, '!file:', !file);
        return res.status(400).json({ 
          success: false, 
          message: 'ID de usuario y archivo requeridos'
        });
      }

      // Generar ruta de imagen usando el nombre asignado por multer
      const imagePath = `/images/users/${req.file.filename}`;
      
      const result = await AuthService.updateProfileImage(targetUserId, imagePath);

      // No hay que verificar result.success porque updateProfileImage no devuelve eso
      // Solo devuelve { id, profile_image_path } en caso de éxito, o tira error en catch

      const LoggerService = require('../services/logger.service');
      LoggerService.info('Foto de perfil de usuario actualizada', 'admin', {
        targetUserId: targetUserId,
        editedBy: req.user.id
      });

      res.json({ 
        success: true, 
        message: 'Foto de perfil actualizada correctamente',
        imagePath: imagePath,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Controlador para Exportar Usuarios a CSV
   * GET /api/users/export
   * Protegido: requiere sesión, permisos de admin y permiso 'exportarUsuarios'
   * 
   * Exporta lista de todos los usuarios en formato CSV
   */
  static async exportUsers(req, res, next) {
    try {
      // Obtener todos los usuarios de la BD
      const result = await AuthService.getAllUsersForExport();
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message || 'Error al exportar usuarios'
        });
      }

      // Preparar datos para CSV
      const users = result.data || [];
      
      // Encabezados del CSV
      const headers = ['ID', 'Nombre', 'Apellido', 'Nombre de Usuario', 'Email', 'Teléfono', 'Rol', 'Estado', 'Fecha Creación', 'Última Actividad'];
      
      // Convertir datos a formato CSV
      const rolNames = { 1: 'Administrador', 2: 'Vendedor', 3: 'Inventario' };
      const rows = users.map(user => [
        user.id,
        `"${user.name?.replace(/"/g, '""') || ''}"`,
        `"${user.last_name?.replace(/"/g, '""') || ''}"`,
        `"${user.username?.replace(/"/g, '""') || ''}"`,
        `"${user.email?.replace(/"/g, '""') || ''}"`,
        `"${user.phone?.replace(/"/g, '""') || ''}"`,
        rolNames[user.role_id] || 'Desconocido',
        user.is_active ? 'Activo' : 'Inactivo',
        user.created_at ? new Date(user.created_at).toLocaleDateString('es-MX') : '',
        user.updated_at ? new Date(user.updated_at).toLocaleDateString('es-MX') : ''
      ]);

      // Crear contenido CSV con BOM para UTF-8
      const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.join(',')).join('\n');

      // Configurar respuesta como descarga de archivo
      const fileName = `usuarios_${new Date().toLocaleDateString('es-MX').replace(/\//g, '-')}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(csvContent);

      // Registrar actividad
      LoggerService.info('Usuarios exportados a CSV', 'admin', {
        userId: req.user.id,
        totalUsers: users.length
      });
    } catch (err) {
      LoggerService.error('Error al exportar usuarios', 'admin', { error: err.message });
      next(err);
    }
  }
}

module.exports = AuthController;