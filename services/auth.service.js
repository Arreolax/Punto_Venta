const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const EmailService = require('./email.service');
const { deleteOldImage } = require('../middleware/upload.middleware');

class AuthService {
  /**
   * 1. Registrar un usuario nuevo en la tabla users
   * @param {string} username - Nombre de usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña en texto plano
   * @param {number} roleId - ID del rol (1=Admin, 2=Empleado)
   * @returns {object} Datos del usuario creado
   */
  static async registerUser(username, email, password, roleId = 2) {
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || 10));
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.query(
        'INSERT INTO users (username, email, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, 1)',
        [username, email, hashedPassword, roleId]
      );
      return { id: result.insertId, username, email, roleId };
    } finally {
      conn.release();
    }
  }

  /**
   * 2. Validar credenciales de usuario y crear sesión
   * Acepta email o username como identificador
   * @param {string} emailOrUsername - Email o username del usuario
   * @param {string} password - Contraseña en texto plano
   * @returns {object} Datos del usuario authenticated
   */
  static async loginUser(emailOrUsername, password) {
    const conn = await pool.getConnection();
    try {
      console.log('[LOGIN_USER] Starting login for:', emailOrUsername);
      
      // Buscar usuario por email O username (sólo campos comunes para compatibilidad con distintos esquemas)
      const [users] = await conn.query(
        `SELECT u.id, u.username, u.name, u.last_name, u.email, u.password_hash, u.role_id, r.name as role, u.is_active, u.is_blocked, u.blocked_until, u.failed_attempts, u.profile_image_path
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.email = ? OR u.username = ?`,
        [emailOrUsername, emailOrUsername]
      );
      
      console.log('[LOGIN_USER] User search result count:', users.length);
      
      if (!users.length) {
        throw new Error('Correo o contraseña inválidos');
      }

      const user = users[0];
      // Compatibilidad con tablas sin columnas name/last_name
      user.name = user.name || user.username;
      user.last_name = user.last_name || '';

      console.log('[LOGIN_USER] User found:', user.username);
      
      // ============================================================
      // VALIDACIONES DE CUENTA
      // ============================================================
      
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || 5);
      const blockedUntilDate = user.blocked_until ? new Date(user.blocked_until) : null;
      const isBlockedByTime = blockedUntilDate instanceof Date && !Number.isNaN(blockedUntilDate.getTime()) && blockedUntilDate > new Date();
      const isActuallyBlocked = isBlockedByTime && (Number(user.is_blocked) === 1 || (Number(user.role_id) !== 1 && Number(user.failed_attempts) >= maxAttempts));

      // Validar si la cuenta está bloqueada temporalmente
      if (isActuallyBlocked) {
        const remainingTime = Math.ceil((blockedUntilDate - new Date()) / 60000);
        throw new Error(`Cuenta bloqueada temporalmente. Tiempo restante: ${remainingTime} minuto(s)`);
      }
      
      // Validar si la cuenta está activa
      if (!user.is_active) {
        throw new Error('Cuenta inactiva');
      }
      
      // Validar si es admin y requiere verificación de email
      // Comentado para compatibilidad con esquema RID.sql que no tiene is_verified
      // if (user.role_id === 1 && !user.is_verified) {
      //   throw new Error('Cuenta de administrador no verificada. Por favor verifica tu email');
      // }

      // ============================================================
      // VALIDACIÓN DE CONTRASEÑA
      // ============================================================
      console.log('[LOGIN_USER] Comparing password');
      const match = await bcrypt.compare(password, user.password_hash);
      console.log('[LOGIN_USER] Password match:', match);
      
      if (!match) {
        // Incrementar contador de intentos fallidos
        console.log('[LOGIN_USER] Password incorrect, incrementing failed attempts');
        const updateResult = await conn.query('UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?', [user.id]);
        console.log('[LOGIN_USER] Failed attempts update result:', updateResult);
        
        // Obtener estado real de intentos después del incremento para evitar condiciones de carrera
        const [stateRows] = await conn.query(
          'SELECT failed_attempts, is_blocked, blocked_until, role_id, email, username FROM users WHERE id = ? LIMIT 1',
          [user.id]
        );
        const currentState = stateRows[0] || user;
        const newAttempts = Number(currentState.failed_attempts || 0);
        console.log(`[LOGIN_USER] New attempts (db): ${newAttempts}, Max: ${maxAttempts}`);
        
        // Activar bloqueo si se alcanzaron máximos intentos
        if (newAttempts >= maxAttempts) {
          const isAdmin = Number(currentState.role_id) === 1;
          const blockDurationMinutes = isAdmin ? 0 : parseInt(process.env.BLOCK_DURATION_MINUTES || 30);
          console.log(`[LOGIN_USER] Maxed out attempts! isAdmin=${isAdmin}, blockDurationMinutes=${blockDurationMinutes}`);
          
          if (!isAdmin && blockDurationMinutes > 0) {
            console.log(`[LOGIN_USER] Bloqueando usuario por ${blockDurationMinutes} minutos...`);
            const [blockResult] = await conn.query(
              `UPDATE users
               SET is_blocked = 1,
                   blocked_until = CASE
                     WHEN blocked_until IS NULL OR blocked_until <= NOW() THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
                     ELSE blocked_until
                   END
               WHERE id = ?`,
              [blockDurationMinutes, user.id]
            );
            console.log('[LOGIN_USER] Block update affected rows:', blockResult?.affectedRows);
            const shouldNotify = Number(blockResult?.changedRows || 0) > 0;
            
            // Obtener fecha/hora de desbloqueo para emails
            let sentCount = 0;
            let failedCount = 0;
            let recipientsCount = 0;
            let blockedUntil = new Date(Date.now() + blockDurationMinutes * 60000);

            try {
              const [updatedRows] = await conn.query('SELECT blocked_until FROM users WHERE id = ?', [user.id]);
              blockedUntil = updatedRows[0]?.blocked_until || blockedUntil;

              // Enviar notificaciones solo cuando el bloqueo se aplica por primera vez
              if (shouldNotify && currentState.email && String(currentState.email).trim() !== '') {
                try {
                  await EmailService.sendAccountBlockedAlert(
                    currentState.email,
                    currentState.username,
                    currentState.username,
                    blockedUntil
                  );
                  sentCount += 1;
                } catch (sendError) {
                  failedCount += 1;
                  console.error('❌ Error enviando alerta de bloqueo al usuario:', {
                    recipient: currentState.email,
                    error: sendError.message
                  });
                }
              }

              // Enviar aviso en broadcast a administradores activos (sin duplicar al usuario bloqueado)
              const [adminRecipients] = await conn.query(
                `SELECT DISTINCT email, username
                 FROM users
                 WHERE role_id = 1
                   AND is_active = 1
                   AND email IS NOT NULL
                   AND TRIM(email) <> ''
                   AND id <> ?`,
                [user.id]
              );

              const uniqueAdmins = Array.from(
                new Map(adminRecipients.map((r) => [String(r.email).trim().toLowerCase(), r])).values()
              );

              recipientsCount = uniqueAdmins.length + (currentState.email ? 1 : 0);

              if (shouldNotify && uniqueAdmins.length > 0) {
                try {
                  const adminResult = await EmailService.sendAccountBlockedAdminBroadcast(
                    uniqueAdmins.map((a) => a.email),
                    currentState.username,
                    blockedUntil
                  );
                  sentCount += Number(adminResult?.acceptedCount || 0);
                  failedCount += Number(adminResult?.failedCount || 0);
                } catch (sendError) {
                  failedCount += uniqueAdmins.length;
                  console.error('❌ Error enviando alerta de bloqueo a administradores:', {
                    recipients: uniqueAdmins.map((a) => a.email),
                    error: sendError.message
                  });
                }
              }
            } catch (notifyError) {
              console.error('[LOGIN_USER] Error en proceso de notificación de bloqueo:', notifyError);
            }

            // Registrar actividad con estadísticas de envío
            try {
              await conn.query(
                'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
                [
                  user.id,
                  'alerta_intentos_fallidos',
                  'auth',
                  `Cuenta bloqueada por ${blockDurationMinutes} min después de ${newAttempts} intentos fallidos. Alertas enviadas: ${sentCount}/${recipientsCount}. Fallidas: ${failedCount}.`
                ]
              );
              console.log(`[LOGIN_USER] ✅ Activity logged: Account blocked after ${newAttempts} attempts. Emails sent: ${sentCount}/${recipientsCount}`);
            } catch (logErr) {
              console.error(`[LOGIN_USER] ⚠️ Error logging blocking activity: ${logErr.message}`);
            }
            
            const remainingTime = Math.ceil((new Date(blockedUntil) - new Date()) / 60000);
            throw new Error(`Cuenta bloqueada temporalmente. Tiempo restante: ${remainingTime} minuto(s)`);
          }
          
          if (isAdmin) {
            // Enviar alerta por email al admin
            console.log('\n🔓 [LOGIN_USER] Admin con 5+ intentos fallidos. Iniciando envío de alerta...');
            console.log(`📧 Email a enviar: ${user.email}`);
            console.log(`👤 Username: ${user.username}`);
            
            try {
              console.log('⏳ Llamando a EmailService.sendFailedAttemptsAlert()...');
              const emailResult = await EmailService.sendFailedAttemptsAlert(user.email, user.username);
              console.log('✅ Email enviado exitosamente:', emailResult);
              
              await conn.query(
                'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
                [user.id, 'alerta_intentos_fallidos', 'auth', `5 intentos de login fallidos detectados`]
              );
              console.log('✅ Actividad registrada en logs');
            } catch (emailError) {
              console.error('❌ Error enviando alerta:', emailError.message);
              console.error('Full error:', emailError);
            }
            throw new Error('Múltiples intentos fallidos. Se ha enviado una alerta a tu correo electrónico');
          }
        }
        
        throw new Error('Correo o contraseña inválidos');
      }

      // ============================================================
      // LOGIN EXITOSO - Resetear contador y crear sesión
      // ============================================================
      console.log('[LOGIN_USER] Password validated, resetting attempts');
      await conn.query('UPDATE users SET failed_attempts = 0, is_blocked = 0, blocked_until = NULL WHERE id = ?', [user.id]);

      // Crear sesión en BD para control de inactividad
      console.log('[LOGIN_USER] Creating session in DB');
      const [sessResult] = await conn.query(
        'INSERT INTO sessions (user_id, is_active, last_activity) VALUES (?, 1, NOW())',
        [user.id]
      );
      const sessionId = sessResult.insertId;
      console.log('[LOGIN_USER] Session created with ID:', sessionId);

      // Registrar actividad de login
      console.log('[LOGIN_USER] Logging activity');
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [user.id, 'login', 'auth', `Login exitoso desde ${emailOrUsername}`]
      );

      console.log('[LOGIN_USER] Login successful, returning user data');
      // Retornar datos del usuario (sin contraseña, sin campos de perfil)
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        last_name: user.last_name,
        email: user.email,
        role_id: user.role_id,
        profile_image_path: user.profile_image_path || null,
        sessionId: sessionId
      };
    } catch (err) {
      console.error('[LOGIN_USER] Error:', err.message);
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * 3. Cerrar sesión de usuario
   * @param {number} userId - ID del usuario
   * @param {number} sessionId - ID de la sesión
   */
  static async logoutUser(userId, sessionId) {
    const conn = await pool.getConnection();
    try {
      // Desactivar sesión en BD
      if (sessionId) {
        await conn.query('UPDATE sessions SET is_active = 0 WHERE id = ?', [sessionId]);
      }

      // Registrar actividad de logout
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [userId, 'logout', 'auth', 'Cierre de Sesión Exitoso']
      );

      return { success: true, message: 'Sesión cerrada correctamente' };
    } finally {
      conn.release();
    }
  }

  /**
   * 4. Cambiar contraseña del usuario actual
   * @param {number} userId - ID del usuario
   * @param {string} oldPassword - Contraseña actual en texto plano
   * @param {string} newPassword - Nueva contraseña en texto plano
   */
  static async changePassword(userId, oldPassword, newPassword) {
    const conn = await pool.getConnection();
    try {
      // Obtener contraseña hasheada del usuario
      const [usuarios] = await conn.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
      
      if (!usuarios.length) {
        throw new Error('Usuario no encontrado');
      }

      // Validar contraseña actual
      const match = await bcrypt.compare(oldPassword, usuarios[0].password_hash);
      if (!match) {
        throw new Error('Contraseña actual incorrecta');
      }

      // Hashear y guardar nueva contraseña
      const hashed = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || 10));
      await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashed, userId]);

      // Registrar actividad
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [userId, 'cambio_contraseña', 'auth', 'Usuario cambió su contraseña']
      );

      return { success: true, message: 'Contraseña actualizada correctamente' };
    } finally {
      conn.release();
    }
  }

  static async getUsers(page = 1, pageSize = 100, filters = {}) {
    const offset = (page - 1) * pageSize;
    const conn = await pool.getConnection();
    try {
      const where = [];
      const params = [];

      if (filters.search) {
        where.push('(username LIKE ? OR email LIKE ? OR name LIKE ? OR last_name LIKE ?)');
        const pattern = `%${filters.search}%`;
        params.push(pattern, pattern, pattern, pattern);
      }

      if (filters.role) {
        const roleMap = {
          administrador: 1,
          vendedor: 2,
          interno: 3
        };
        const roleId = roleMap[filters.role];
        if (roleId) {
          where.push('role_id = ?');
          params.push(roleId);
        }
      }

      if (filters.status) {
        if (filters.status === 'activo') {
          where.push('is_active = 1');
        } else if (filters.status === 'inactivo') {
          where.push('is_active = 0');
        }
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const [users] = await conn.query(
        `SELECT u.id, u.username, u.name, u.last_name, u.email, u.phone, u.role_id, u.is_active, u.job_position, u.birth_date, u.profile_image_path, u.created_at, u.updated_at,
                (SELECT MAX(s.last_activity) FROM sessions s WHERE s.user_id = u.id) AS last_access
         FROM users u
         ${whereClause}
         ORDER BY u.id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );
      const [countResult] = await conn.query(
        `SELECT COUNT(*) as total FROM users ${whereClause}`,
        params
      );
      return {
        users,
        total: countResult[0].total
      };
    } finally {
      conn.release();
    }
  }

  static async getUserById(userId) {
    const conn = await pool.getConnection();
    try {
      // Obtener datos completos del usuario incluyendo campos de perfil
      const [rows] = await conn.query(
        `SELECT u.id, u.username, u.name, u.last_name, u.email, u.role_id, u.is_active, u.job_position, u.birth_date, u.phone, u.profile_image_path, u.individual_permissions, u.created_at,
                (SELECT MAX(s.last_activity) FROM sessions s WHERE s.user_id = u.id) AS last_access
         FROM users u
         WHERE u.id = ?`,
        [userId]
      );
      return rows.length ? rows[0] : null;
    } finally {
      conn.release();
    }
  }

  static async getIndividualPermissions(userId) {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query('SELECT individual_permissions FROM users WHERE id = ?', [userId]);
      if (!rows.length) return {};
      const raw = rows[0].individual_permissions;
      if (!raw) return {};
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          // Compatibilidad con datos legacy: migrar clave con ñ a clave ASCII.
          if (Object.prototype.hasOwnProperty.call(parsed, 'cambiarContraseñas')
            && !Object.prototype.hasOwnProperty.call(parsed, 'cambiarContrasenas')) {
            parsed.cambiarContrasenas = Boolean(parsed.cambiarContraseñas);
          }
          delete parsed.cambiarContraseñas;
          return parsed;
        } catch (e) {
          return {};
        }
      }
      if (raw && typeof raw === 'object') {
        if (Object.prototype.hasOwnProperty.call(raw, 'cambiarContraseñas')
          && !Object.prototype.hasOwnProperty.call(raw, 'cambiarContrasenas')) {
          raw.cambiarContrasenas = Boolean(raw.cambiarContraseñas);
        }
        delete raw.cambiarContraseñas;
      }
      return raw;
    } finally {
      conn.release();
    }
  }

  static async getEffectivePermissions(userId) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Fallback (defaults por rol)
    const roleDefaults = {
      1: { consultarOtrosUsuarios: true, consultarPermisos: true, crearUsuarios: true, cambiarContrasenas: true, eliminarUsuarios: true, exportarUsuarios: true, consultarStocks: true, consultarMovimientosStock: true, crearAlmacenes: true, verInventarios: true, eliminarAlmacenes: true, eliminarInventario: true, registrarMovimientos: true, eliminarMovimientos: true, exportarReportes: true, importarDatos: true, impresionDirecta: true, impresoraTickets: true, leerMargenes: true, definirMargenes: true, lanzarImportaciones: true, obtenerResultadoExportacion: true, crearEditarExportaciones: true },
      2: { consultarOtrosUsuarios: true, consultarPermisos: false, crearUsuarios: false, cambiarContrasenas: false, eliminarUsuarios: false, exportarUsuarios: false, consultarStocks: true, consultarMovimientosStock: true, crearAlmacenes: false, verInventarios: true, eliminarAlmacenes: false, eliminarInventario: true, registrarMovimientos: true, eliminarMovimientos: false, exportarReportes: false, importarDatos: false, impresionDirecta: false, impresoraTickets: false, leerMargenes: false, definirMargenes: false, lanzarImportaciones: false, obtenerResultadoExportacion: false, crearEditarExportaciones: false },
      3: { consultarOtrosUsuarios: true, consultarPermisos: false, crearUsuarios: false, cambiarContrasenas: false, eliminarUsuarios: false, exportarUsuarios: false, consultarStocks: true, consultarMovimientosStock: true, crearAlmacenes: false, verInventarios: true, eliminarAlmacenes: false, eliminarInventario: false, registrarMovimientos: false, eliminarMovimientos: false, exportarReportes: false, importarDatos: false, impresionDirecta: false, impresoraTickets: false, leerMargenes: false, definirMargenes: false, lanzarImportaciones: false, obtenerResultadoExportacion: false, crearEditarExportaciones: false }
    };

    // Obtener permisos: role_permissions de la tabla + individual_permissions del usuario
    const rolePermissions = await this.getRolePermissions(user.role_id);
    const individualPermissions = await this.getIndividualPermissions(userId);

    // Contar cuántos permisos de rol son true (si tabla role_permissions tiene datos)
    const roleTrueCount = Object.values(rolePermissions).filter(v => v === true).length;

    // Si no hay permisos específicos de rol en la tabla, usar roleDefaults como base
    // Luego aplicar individual_permissions como override
    const basePermissions = roleTrueCount === 0 
      ? roleDefaults[user.role_id] || roleDefaults[1]
      : rolePermissions;

    const mergedPermissions = {
      ...basePermissions,
      ...individualPermissions
    };

    return mergedPermissions;
  }

  static async updateProfile(userId, { username, email, phone, jobPosition, birthDate, profileImagePath }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Validar usuario único (solo si se está cambiando username o email)
      const [existing] = await conn.query(
        'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
        [username, email, userId]
      );
      if (existing.length) {
        throw new Error('Nombre de usuario o email ya en uso');
      }

      // Validaciones opcionales para campos de perfil
      if (jobPosition && typeof jobPosition !== 'string') {
        throw new Error('El puesto de trabajo debe ser una cadena de texto');
      }

      if (phone && typeof phone !== 'string') {
        throw new Error('El teléfono debe ser una cadena de texto');
      }

      if (birthDate !== null && birthDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        throw new Error('La fecha de nacimiento debe estar en formato YYYY-MM-DD');
      }

      // Si hay nueva imagen, eliminar la anterior
      if (profileImagePath) {
        const [currentUser] = await conn.query(
          'SELECT profile_image_path FROM users WHERE id = ?',
          [userId]
        );
        if (currentUser.length && currentUser[0].profile_image_path) {
          deleteOldImage(currentUser[0].profile_image_path);
        }
      }

      // Actualizar perfil del usuario
      const queryValues = profileImagePath 
        ? [username, email, phone || null, jobPosition || null, birthDate || null, profileImagePath, userId]
        : [username, email, phone || null, jobPosition || null, birthDate || null, userId];
      
      const query = profileImagePath
        ? 'UPDATE users SET username = ?, email = ?, phone = ?, job_position = ?, birth_date = ?, profile_image_path = ? WHERE id = ?'
        : 'UPDATE users SET username = ?, email = ?, phone = ?, job_position = ?, birth_date = ? WHERE id = ?';
      
      await conn.query(query, queryValues);

      // Guardar actividad
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [userId, 'perfil_actualizado', 'auth', `Perfil actualizado${profileImagePath ? ' con nueva imagen' : ''}`]
      );

      await conn.commit();

      return { 
        id: userId, 
        username, 
        email, 
        phone, 
        jobPosition: jobPosition || null, 
        birthDate: birthDate || null,
        profile_image_path: profileImagePath || null
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Actualizar solo la imagen de perfil de un usuario
   * @param {number} userId - ID del usuario
   * @param {string} profileImagePath - Ruta de la nueva imagen (ej: /images/users/123_timestamp.jpg)
   * @returns {object} Datos del usuario actualizado
   */
  static async updateProfileImage(userId, profileImagePath) {
    const conn = await pool.getConnection();
    try {
      // Obtener imagen anterior para eliminarla
      const [userRows] = await conn.query(
        'SELECT profile_image_path FROM users WHERE id = ?',
        [userId]
      );

      if (!userRows.length) {
        throw new Error('Usuario no encontrado');
      }

      const oldImagePath = userRows[0].profile_image_path;
      
      // Actualizar nueva imagen
      await conn.query(
        'UPDATE users SET profile_image_path = ? WHERE id = ?',
        [profileImagePath, userId]
      );

      // Eliminar imagen anterior si existía
      if (oldImagePath) {
        deleteOldImage(oldImagePath);
      }

      // Registrar actividad
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [userId, 'imagen_perfil_actualizada', 'auth', `Imagen de perfil actualizada`]
      );

      return { 
        id: userId, 
        profile_image_path: profileImagePath 
      };
    } catch (err) {
      throw err;
    } finally {
      conn.release();
    }
  }



  static async getRolePermissions(roleId) {
    const conn = await pool.getConnection();
    try {
      const helper = {
        consultarOtrosUsuarios: 'consultar_otros_usuarios',
        consultarPermisos: 'consultar_permisos',
        crearUsuarios: 'crear_usuarios',
        cambiarContrasenas: 'cambiar_contraseñas',
        eliminarUsuarios: 'eliminar_usuarios',
        exportarUsuarios: 'exportar_usuarios',
        consultarStocks: 'consultar_stocks',
        consultarMovimientosStock: 'consultar_movimientos_stock',
        crearAlmacenes: 'crear_almacenes',
        verInventarios: 'ver_inventarios',
        eliminarAlmacenes: 'eliminar_almacenes',
        eliminarInventario: 'eliminar_inventario',
        registrarMovimientos: 'registrar_movimientos',
        eliminarMovimientos: 'eliminar_movimientos',
        exportarReportes: 'exportar_reportes',
        importarDatos: 'importar_datos',
        impresionDirecta: 'impresion_directa',
        impresoraTickets: 'impresora_tickets',
        leerMargenes: 'leer_margenes',
        definirMargenes: 'definir_margenes',
        lanzarImportaciones: 'lanzar_importaciones',
        obtenerResultadoExportacion: 'obtener_resultado_exportacion',
        crearEditarExportaciones: 'crear_editar_exportaciones'
      };

      const reverse = Object.fromEntries(Object.entries(helper).map(([k, v]) => [v, k]));

      const [rows] = await conn.query(
        `SELECT p.name FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = ?`,
        [roleId]
      );

      const permissions = {};
      Object.keys(helper).forEach(key => { permissions[key] = false; });

      rows.forEach(row => {
        const appKey = reverse[row.name];
        if (appKey) {
          permissions[appKey] = true;
        }
      });

      return permissions;
    } finally {
      conn.release();
    }
  }

  static async updateUserPermissions(userId, permissions) {
    const conn = await pool.getConnection();
    const mapPerm = {
      consultarOtrosUsuarios: 'consultar_otros_usuarios',
      consultarPermisos: 'consultar_permisos',
      crearUsuarios: 'crear_usuarios',
      cambiarContrasenas: 'cambiar_contraseñas',
      eliminarUsuarios: 'eliminar_usuarios',
      exportarUsuarios: 'exportar_usuarios',
      consultarStocks: 'consultar_stocks',
      consultarMovimientosStock: 'consultar_movimientos_stock',
      crearAlmacenes: 'crear_almacenes',
      verInventarios: 'ver_inventarios',
      eliminarAlmacenes: 'eliminar_almacenes',
      eliminarInventario: 'eliminar_inventario',
      registrarMovimientos: 'registrar_movimientos',
      eliminarMovimientos: 'eliminar_movimientos',
      exportarReportes: 'exportar_reportes',
      importarDatos: 'importar_datos',
      impresionDirecta: 'impresion_directa',
      impresoraTickets: 'impresora_tickets',
      leerMargenes: 'leer_margenes',
      definirMargenes: 'definir_margenes',
      lanzarImportaciones: 'lanzar_importaciones',
      obtenerResultadoExportacion: 'obtener_resultado_exportacion',
      crearEditarExportaciones: 'crear_editar_exportaciones'
    };

    try {
      await conn.beginTransaction();

      const [users] = await conn.query('SELECT id FROM users WHERE id = ?', [userId]);
      if (!users.length) {
        throw new Error('Usuario no encontrado');
      }

      const userPermissions = {};
      Object.keys(mapPerm).forEach(key => {
        userPermissions[key] = Boolean(permissions[key]);
      });

      await conn.query(
        'UPDATE users SET individual_permissions = ? WHERE id = ?',
        [JSON.stringify(userPermissions), userId]
      );

      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [userId, 'permisos_usuario_actualizado', 'auth', JSON.stringify(userPermissions)]
      );

      await conn.commit();

      return { success: true, userId, permissions: userPermissions };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Crear usuario (solo Admin)
   * @param {string} username - Nombre de usuario (requerido)
   * @param {string} email - Email (requerido)
   * @param {string} password - Contraseña en texto plano (requerido, mín 8 caracteres)
   * @param {number} roleId - ID del rol (requerido, 1=Admin, 2=Empleado, 3=Interno)
   * @param {string} jobPosition - Puesto de trabajo (opcional)
   * @param {string} birthDate - Fecha de nacimiento en formato YYYY-MM-DD (opcional)
   */
  static async createUser(username, name, last_name, email, password, roleId, jobPosition = null, birthDate = null, phone = null, profileImagePath = null) {
    const conn = await pool.getConnection();
    
    try {
      // ============ VALIDACIONES BASICAS ============
      
      if (!username || !email || !password || !roleId) {
        throw new Error('Datos incompletos');
      }

      if (password.length < 8) {
        throw new Error('La contraseña debe tener al menos 8 caracteres');
      }

      // ============ VALIDACIONES OPCIONALES PARA CAMPOS DE PERFIL ============
      
      if (jobPosition && typeof jobPosition !== 'string') {
        throw new Error('El puesto de trabajo debe ser una cadena de texto');
      }

      if (phone && typeof phone !== 'string') {
        throw new Error('El teléfono debe ser una cadena de texto');
      }

      if (birthDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        throw new Error('La fecha de nacimiento debe estar en formato YYYY-MM-DD');
      }

      // Hash PRE-transacción (operación lenta)
      const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || 10));
      const roleIdNum = Number(roleId);
      const isAdmin = roleIdNum === 1;

      // ============ VALIDAR ROL (fuera de transacción) ============
      const [roles] = await conn.query('SELECT id FROM roles WHERE id = ?', [roleId]);
      if (!roles.length) {
        throw new Error('Rol inválido');
      }

      // Inicializar permisos individuales con la plantilla completa del rol.
      // Esto evita que el JSON quede vacío en usuarios recién creados.
      const roleTemplatePermissions = await this.getRolePermissions(roleIdNum);
      const defaultIndividualPermissions = JSON.stringify(roleTemplatePermissions || {});

      // ============ TRANSACCION MINIMA - SOLO INSERT ============
      
      await conn.beginTransaction();

      try {
        // INSERTAR USUARIO CON CAMPOS DE PERFIL - transacción mínima
        // ⚠️ is_active = 0: Usuario nace inactivo y se activa únicamente al verificar token de email o por activación manual admin
        const [result] = await conn.query(
          'INSERT INTO users (username, name, last_name, email, password_hash, role_id, job_position, birth_date, phone, profile_image_path, individual_permissions, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
          [username, name, last_name, email, hashedPassword, roleIdNum, jobPosition || null, birthDate || null, phone || null, profileImagePath || null, defaultIndividualPermissions]
        );

        const userId = result.insertId;
        await conn.commit();
        console.log(`[CreateUser] Usuario creado: ${username} (ID: ${userId}) con perfil: name=${name}, last_name=${last_name}, job=${jobPosition}, phone=${phone}, birthdate=${birthDate}, image=${profileImagePath}`);

        // ============ OPERACIONES POST-INSERT (fuera de transacción principal) ============

        // Asignar permisos si es admin (sin transacción)
        if (isAdmin) {
          try {
            const [allPermissions] = await conn.query('SELECT id FROM permissions');
            for (const perm of allPermissions) {
              await conn.query(
                'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                [roleIdNum, perm.id]
              );
            }
          } catch (permErr) {
            console.error(`[CreateUser] Advertencia - No se pudieron asignar permisos: ${permErr.message}`);
            // No falla, continúa
          }
        }

        // Registrar en logs (sin transacción)
        try {
          await conn.query(
            'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
            [userId, 'cuenta_creada', 'auth', `Usuario: ${username}`]
          );
        } catch (logErr) {
          console.error(`[CreateUser] Advertencia - No se pudo registrar actividad: ${logErr.message}`);
          // No falla, continúa
        }

        // EMAIL EN BACKGROUND (no bloquea respuesta)
        // Flujo global: todos los roles deben verificar email para activar su cuenta.
        setImmediate(async () => {
          try {
            const token = await EmailService.createVerificationToken(userId);
            await EmailService.sendVerificationEmail(email, token);
          } catch (err) {
            console.error(`[CreateUser] Email error:`, err.message);
          }
        });

        return { 
          id: userId, 
          username, 
          name,
          last_name,
          email, 
          role_id: roleIdNum,
          message: isAdmin 
            ? 'Administrador creado correctamente' 
            : 'Empleado creado exitosamente'
        };

      } catch (txnErr) {
        await conn.rollback();
        throw txnErr;
      }

    } catch (err) {
      console.error(`[CreateUser] Error: ${err.message}`);
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * 6. Eliminar usuario (solo Admin)
   * @param {number} userId - ID del usuario a eliminar
   */
  static async deleteUser(userId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Verificar que el usuario exista
      const [users] = await conn.query('SELECT id FROM users WHERE id = ?', [userId]);
      if (!users.length) {
        throw new Error('Usuario no encontrado');
      }

      // Desactivar sesiones activas del usuario
      await conn.query('UPDATE sessions SET is_active = 0 WHERE user_id = ?', [userId]);

      // Si el usuario tiene historial ligado por FK (ej. movimientos), no se elimina físicamente.
      const [movementRefs] = await conn.query(
        'SELECT COUNT(*) AS total FROM inventory_movements WHERE user_id = ?',
        [userId]
      );

      const hasInventoryHistory = Number(movementRefs[0]?.total || 0) > 0;

      if (hasInventoryHistory) {
        await conn.query(
          'UPDATE users SET is_active = 0 WHERE id = ?',
          [userId]
        );

        await conn.commit();
        return {
          success: true,
          message: 'El usuario tiene historial de inventario y fue desactivado para conservar trazabilidad'
        };
      }

      // Si no hay referencias, eliminar físicamente.
      await conn.query('DELETE FROM users WHERE id = ?', [userId]);

      await conn.commit();
      return { success: true, message: 'Usuario eliminado correctamente' };
    } catch (err) {
      await conn.rollback();

      if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new Error('No se puede eliminar el usuario porque tiene registros relacionados');
      }

      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * 7. Resetear contraseña de empleado (solo Admin)
   * @param {number} employeeId - ID del empleado
   * @param {string} newPassword - Nueva contraseña en texto plano
   * @param {number} adminId - ID del admin que realiza el cambio
   */
  static async resetEmployeePassword(employeeId, newPassword, adminId) {
    const conn = await pool.getConnection();
    try {
      // Verificar que sea un empleado (role_id = 2)
      const [employees] = await conn.query(
        'SELECT id, role_id FROM users WHERE id = ?',
        [employeeId]
      );
      
      if (!employees.length) {
        throw new Error('Usuario no encontrado');
      }
      
      const employee = employees[0];
      if (employee.role_id !== 2) {
        throw new Error('Solo se puede cambiar contraseña de empleados');
      }

      // Hashear y guardar nueva contraseña
      const hashed = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || 10));
      await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashed, employeeId]);

      // Registrar actividad
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [adminId, 'reset_contraseña_empleado', 'admin', `Contraseña del empleado ${employeeId} fue reseteada`]
      );

      return { success: true, message: 'Contraseña del empleado actualizada correctamente' };
    } finally {
      conn.release();
    }
  }

  /**
   * 8. Obtener logs de actividad (solo Admin)
   * @param {object} filters - Filtros: userId, module, startDate, endDate
   * @returns {object} Lista de logs de actividad
   */
  static async getActivityLogs(filters = {}) {
    const conn = await pool.getConnection();
    try {
      let query = `
        SELECT 
          al.id, 
          al.user_id, 
          al.action, 
          al.module, 
          al.details, 
          al.created_at, 
          u.username 
        FROM activity_logs al 
        JOIN users u ON al.user_id = u.id 
        WHERE 1=1
      `;
      const params = [];

      // Filtro por usuario
      if (filters.userId) {
        query += ' AND al.user_id = ?';
        params.push(filters.userId);
      }

      // Filtro por módulo
      if (filters.module) {
        query += ' AND al.module = ?';
        params.push(filters.module);
      }

      // Filtro por fecha inicial
      if (filters.startDate) {
        query += ' AND al.created_at >= ?';
        params.push(filters.startDate);
      }

      // Filtro por fecha final
      if (filters.endDate) {
        query += ' AND al.created_at <= ?';
        params.push(filters.endDate);
      }

      // Ordenar por fecha descendente y limitar a 500
      query += ' ORDER BY al.created_at DESC LIMIT 500';

      const [logs] = await conn.query(query, params);
      return { success: true, count: logs.length, data: logs };
    } finally {
      conn.release();
    }
  }

  /**
   * 9. Verificar token de email y marcar usuario como verificado
   * @param {string} token - Token de verificación
   */
  static async verifyEmailToken(token) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Verificar token
      const { valid, userId } = await EmailService.verifyToken(token);
      if (!valid) {
        throw new Error('Token inválido o expirado');
      }

      // Marcar usuario como verificado Y activar cuenta automáticamente
      // 🟢 is_verified = 1: Email confirmado
      // 🟢 is_active = 1: Usuario puede loguearse inmediatamente
      const [result] = await conn.query(
        'UPDATE users SET is_verified = 1, is_active = 1 WHERE id = ?',
        [userId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Usuario no encontrado');
      }

      // Registrar actividad: email verificado Y usuario activado
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [userId, 'email_verificado_y_activado', 'auth', 'Email verificado correctamente y usuario activado automáticamente']
      );

      await conn.commit();
      return { success: true, message: 'Email verificado correctamente' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * 10. Actualizar estado activo/inactivo de usuario
   * @param {number} userId - ID del usuario a actualizar
   * @param {boolean} active - Nuevo estado activo
   * @param {number} adminId - ID del admin que realiza el cambio
   */
  static async updateUserStatus(userId, active, adminId) {
    const conn = await pool.getConnection();
    try {
      // Verificar que el usuario existe
      const [users] = await conn.query('SELECT id, username FROM users WHERE id = ?', [userId]);
      if (!users.length) {
        throw new Error('Usuario no encontrado');
      }

      // Actualizar estado
      await conn.query('UPDATE users SET is_active = ? WHERE id = ?', [active ? 1 : 0, userId]);

      // Registrar actividad
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [adminId, active ? 'activar_usuario' : 'desactivar_usuario', 'admin', `Usuario ${users[0].username} ${active ? 'activado' : 'desactivado'}`]
      );

      return { success: true, userId, active };
    } finally {
      conn.release();
    }
  }

  /**
   * 10. Reenviar email de verificación a admin
   * @param {number} userId - ID del usuario
   */
  static async resendVerificationEmail(userId) {
    const conn = await pool.getConnection();
    try {
      // Obtener usuario admin
      const [users] = await conn.query(
        'SELECT id, email, is_verified FROM users WHERE id = ? AND role_id = 1',
        [userId]
      );

      if (!users.length) {
        throw new Error('Usuario administrador no encontrado');
      }

      const user = users[0];
      if (user.is_verified) {
        throw new Error('Este usuario ya está verificado');
      }

      // Generar nuevo token de verificación
      const token = await EmailService.createVerificationToken(userId);

      // Enviar email
      await EmailService.sendVerificationEmail(user.email, token);

      // Registrar actividad
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [userId, 'reenvio_email_verificacion', 'auth', 'Email de verificación reenviado']
      );

      return { success: true, message: 'Email de verificación reenviado' };
    } finally {
      conn.release();
    }
  }

  /**
   * 11. Solicitar recuperación de contraseña por email
   * @param {string} email - Email del usuario
   */
  static async requestPasswordReset(email) {
    const conn = await pool.getConnection();
    try {
      // Obtener usuario por email
      const [users] = await conn.query(
        'SELECT id, email, username, role_id FROM users WHERE email = ?',
        [email]
      );

      // Por seguridad, retornar mensaje genérico aunque no exista el usuario
      if (!users.length) {
        return { 
          success: true, 
          message: 'Si la cuenta existe, recibirás un email con instrucciones de recuperación' 
        };
      }

      const user = users[0];

      // Regla de negocio: vendedores no pueden recuperar contraseña por email.
      // Deben contactar a un administrador para cambio manual.
      if (Number(user.role_id) === 2) {
        return {
          success: false,
          warning: true,
          message: 'Para cambiar tu contraseña, contacta a un administrador.'
        };
      }

      // Generar token de reseteo
      const token = await EmailService.createVerificationToken(user.id);

      // Enviar email con enlace de reseteo
      await EmailService.sendPasswordResetEmail(user.email, user.username, token);

      // Registrar actividad
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [user.id, 'solicitud_reseteo_contraseña', 'auth', 'Solicitud de recuperación de contraseña iniciada']
      );

      // Respuesta genérica por seguridad
      return { 
        success: true, 
        message: 'Si la cuenta existe, recibirás un email con instrucciones de recuperación' 
      };
    } finally {
      conn.release();
    }
  }

  /**
   * 12. Resetear contraseña con token válido
   * @param {string} token - Token de reseteo
   * @param {string} newPassword - Nueva contraseña en texto plano
   */
  static async resetPasswordWithToken(token, newPassword) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Verificar token
      const { valid, userId } = await EmailService.verifyToken(token);
      if (!valid) {
        throw new Error('Token inválido o expirado');
      }

      // Hashear nueva contraseña
      const hashed = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || 10));

      // Actualizar contraseña
      const [result] = await conn.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashed, userId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Usuario no encontrado');
      }

      // Registrar actividad
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [userId, 'reseteo_contraseña', 'auth', 'Contraseña reseteada exitosamente']
      );

      await conn.commit();
      return { success: true, message: 'Contraseña reseteada correctamente' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * 13. Editar información de usuario (solo admin)
   * @param {number} userId - ID del usuario a editar
   * @param {object} data - { username, email, phone, role_id }
   */
  static async editUserInformation(userId, { username, email, phone, role_id, is_active }) {
    const conn = await pool.getConnection();
    try {
      // Validar que el usuario existe
      const [existingUsers] = await conn.query('SELECT id, username FROM users WHERE id = ?', [userId]);
      if (!existingUsers.length) {
        throw new Error('Usuario no encontrado');
      }

      // Validar que el nuevo rol existe
      const [roleCheck] = await conn.query('SELECT id FROM roles WHERE id = ?', [role_id]);
      if (!roleCheck.length) {
        throw new Error('Rol inválido');
      }

      // Verificar si el nuevo username/email ya están en uso (excepto por el usuario actual)
      const [duplicates] = await conn.query(
        'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
        [username, email, userId]
      );
      if (duplicates.length) {
        throw new Error('Username o email ya están en uso');
      }

      // Actualizar información
      const isActiveValue = is_active === true || is_active === 1 ? 1 : 0;
      await conn.query(
        'UPDATE users SET username = ?, email = ?, phone = ?, role_id = ?, is_active = ? WHERE id = ?',
        [username, email, phone || null, role_id, isActiveValue, userId]
      );

      // Registrar actividad
      await conn.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [userId, 'informacion_editada', 'admin', `Información de usuario actualizada: username=${username}, email=${email}, phone=${phone}, role=${role_id}, is_active=${isActiveValue}`]
      );

      return {
        id: userId,
        username,
        email,
        phone,
        role_id,
        is_active: isActiveValue,
        message: 'Información actualizada correctamente'
      };
    } finally {
      conn.release();
    }
  }

  /**
   * Obtiene lisdo de usuarios para exportar a CSV
   */
  static async getAllUsersForExport() {
    const conn = await pool.getConnection();
    try {
      const [users] = await conn.query(
        `SELECT 
          id,
          name,
          last_name,
          username,
          email,
          phone,
          role_id,
          is_active,
          created_at,
          updated_at
         FROM users 
         ORDER BY id ASC`
      );

      return {
        success: true,
        data: users,
        message: 'Usuarios exportados correctamente'
      };
    } catch (err) {
      console.error('Error al obtener usuarios para exportar:', err);
      return {
        success: false,
        message: 'Error al obtener usuarios para exportar'
      };
    } finally {
      conn.release();
    }
  }
}

module.exports = AuthService;

