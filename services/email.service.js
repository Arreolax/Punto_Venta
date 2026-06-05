const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

class EmailService {
  static transporter = null;

  /**
   * Inicializar el transporter de nodemailer con SMTP de Gmail
   */
  static initializeTransporter() {
    if (this.transporter) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    return this.transporter;
  }

  /**
   * Obtener logo como base64 inline para emails
   * Evita que aparezca como attachment descargable
   * @returns {string} Data URI del logo en base64
   */
  static getLogoBase64() {
    try {
      const logoPath = path.join(__dirname, '../public/images/logo-b.png');
      const logoBuffer = fs.readFileSync(logoPath);
      const base64 = logoBuffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('Error reading logo file:', error);
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfAQAFhAJ/wlseKgAAAABJRU5ErkJggg==';
    }
  }

  /**
   * Generar token de verificación único
   */
  static generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Crear y guardar token de verificación en BD
   * @param {number} userId - ID del usuario
   * @returns {string} token generado
   */
  static async createVerificationToken(userId) {
    const conn = await pool.getConnection();
    try {
      const token = this.generateVerificationToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      await conn.query(
        'INSERT INTO verification_tokens (user_id, token, expires_at, is_used) VALUES (?, ?, ?, 0)',
        [userId, token, expiresAt]
      );

      return token;
    } finally {
      conn.release();
    }
  }

  /**
   * Verificar token y marcar como usado
   * @param {string} token
   * @returns {object} {valid: boolean, userId: number}
   */
  static async verifyToken(token) {
    const conn = await pool.getConnection();
    try {
      const [tokens] = await conn.query(
        'SELECT id, user_id, is_used, expires_at FROM verification_tokens WHERE token = ?',
        [token]
      );

      if (!tokens.length) {
        throw new Error('Token de verificación inválido');
      }

      const verToken = tokens[0];

      if (verToken.is_used) {
        throw new Error('Token ya fue utilizado');
      }

      if (new Date(verToken.expires_at) < new Date()) {
        throw new Error('Token expirado');
      }

      // Marcar como usado
      await conn.query('UPDATE verification_tokens SET is_used = 1 WHERE id = ?', [verToken.id]);

      return { valid: true, userId: verToken.user_id };
    } finally {
      conn.release();
    }
  }

  /**
   * Enviar email de verificación para nuevo administrador
   * @param {string} email - Email del admin
   * @param {string} token - Token de verificación
   */
  static async sendVerificationEmail(email, token) {
    const transporter = this.initializeTransporter();
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f97316;">
            <img src="cid:logo" alt="Ruedas Industriales Durango" style="max-height: 120px; margin: 0 auto 15px; display: block;" width="180" />
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h1 style="color: #333;">Bienvenido al Sistema de Punto de Venta</h1>
            <p style="color: #666; font-size: 16px;">
              Se ha creado una cuenta de administrador para ti. Por favor, verifica tu email haciendo clic en el botón de abajo.
            </p>
            <p style="margin: 20px 0;">
              <a href="${verificationLink}" 
                 style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Verificar Email
              </a>
            </p>
            <p style="color: #999; font-size: 12px;">
              Este link expira en 24 horas.
            </p>
            <hr style="border: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Si no creaste esta cuenta, por favor ignora este email.
            </p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Verificar Email - Sistema de Punto de Venta',
      text: 'Por favor verifica tu email haciendo clic en el enlace que recibiste.',
      html: htmlBody,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '../public/images/logo-b.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, message: 'Email de verificación enviado' };
    } catch (error) {
      console.error('Error enviando email de verificación:', error);
      throw new Error(`Error enviando email: ${error.message}`);
    }
  }

  /**
   * Enviar email de alerta para múltiples intentos fallidos (Admin)
   * @param {string} email - Email del admin
   * @param {string} username - Username del admin
   */
  static async sendFailedAttemptsAlert(email, username) {
    const transporter = this.initializeTransporter();

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f97316;">
            <img src="cid:logo" alt="Ruedas Industriales Durango" style="max-height: 120px; margin: 0 auto 15px; display: block;" width="180" />
          </div>
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; border-left: 5px solid #ffc107;">
            <h1 style="color: #856404;">⚠️ Alerta de Seguridad</h1>
            <p style="color: #856404; font-size: 16px;">
              Se han detectado 5 intentos fallidos de iniciar sesión en tu cuenta.
            </p>
            <div style="background-color: #fffbea; padding: 15px; border-radius: 3px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Usuario:</strong> ${username}</p>
              <p style="margin: 5px 0;"><strong>Fecha/Hora:</strong> ${new Date().toLocaleString('es-ES')}</p>
              <p style="margin: 5px 0;"><strong>Acción:</strong> Alerta de múltiples intentos</p>
            </div>
            <p style="color: #856404; font-size: 14px;">
              Si fuiste tú, no necesitas hacer nada. Si no fuiste tú, por favor considera cambiar tu contraseña de inmediato.
            </p>
            <hr style="border: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Este es un email automático de seguridad. Por favor no respondas a este mensaje.
            </p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: '⚠️ Alerta de Seguridad - Múltiples Intentos Fallidos',
      text: 'Se han detectado 5 intentos fallidos de iniciar sesión en tu cuenta. Si no fuiste tú, cambia tu contraseña inmediatamente.',
      html: htmlBody,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '../public/images/logo-b.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      console.log('[sendFailedAttemptsAlert] Enviando email a:', email);
      const info = await transporter.sendMail(mailOptions);
      console.log('[sendFailedAttemptsAlert] Email enviado exitosamente', {
        to: email,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      });
      return { success: true, message: 'Alerta de seguridad enviada' };
    } catch (error) {
      console.error('[sendFailedAttemptsAlert] Error enviando alerta:', {
        email,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Error enviando email: ${error.message}`);
    }
  }

  /**
   * Enviar email de notificación cuando la cuenta se bloquea por intentos fallidos
   * @param {string} email - Email del usuario
   * @param {string} username - Username del usuario
   * @param {number} blockDurationMinutes - Minutos que durará el bloqueo
   */
  static async sendAccountLockedNotification(email, username, blockDurationMinutes) {
    const transporter = this.initializeTransporter();

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #d9534f;">
            <img src="cid:logo" alt="Ruedas Industriales Durango" style="max-height: 120px; margin: 0 auto 15px; display: block;" width="180" />
          </div>
          <div style="background-color: #f2dede; padding: 20px; border-radius: 5px; border-left: 5px solid #d9534f;">
            <h1 style="color: #a94442;">🔒 Cuenta Bloqueada por Seguridad</h1>
            <p style="color: #a94442; font-size: 16px;">
              Tu cuenta ha sido temporalmente bloqueada debido a múltiples intentos fallidos de iniciar sesión.
            </p>
            <div style="background-color: #faf1f0; padding: 15px; border-radius: 3px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>👤 Usuario:</strong> ${username}</p>
              <p style="margin: 5px 0;"><strong>🔒 Duración del bloqueo:</strong> ${blockDurationMinutes} minutos</p>
              <p style="margin: 5px 0;"><strong>📅 Fecha/Hora:</strong> ${new Date().toLocaleString('es-ES')}</p>
            </div>
            <h3 style="color: #a94442;">Acciones recomendadas:</h3>
            <ul style="color: #a94442;">
              <li>Espera ${blockDurationMinutes} minutos antes de intentar iniciar sesión nuevamente</li>
              <li>Si crees que fue un error de contraseña, recuerda que es sensible a mayúsculas/minúsculas</li>
              <li>Si no fuiste tú, contacta inmediatamente a un administrador para verificar tu seguridad</li>
            </ul>
            <hr style="border: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Este es un email automático de seguridad. Por favor no respondas a este mensaje. 
              Si tienes dudas, contacta al equipo de soporte.
            </p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: '🔒 Cuenta Bloqueada Temporalmente - Intenta Más Tarde',
      text: `Tu cuenta ha sido bloqueada por ${blockDurationMinutes} minutos debido a múltiples intentos fallidos de login. Por favor intenta iniciar sesión después de ese tiempo.`,
      html: htmlBody,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '../public/images/logo-b.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, message: 'Notificación de bloqueo enviada' };
    } catch (error) {
      console.error('Error enviando notificación de bloqueo:', error);
      throw new Error(`Error enviando email: ${error.message}`);
    }
  }

  /**
   * Enviar alerta de cuenta bloqueada a múltiples destinatarios (admins + usuario bloqueado)
   * @param {string} recipientEmail - Email del destinatario
   * @param {string} recipientUsername - Username del destinatario (admin o usuario)
   * @param {string} blockedUsername - Username del usuario que fue bloqueado
   * @param {Date|string} blockedUntil - Fecha/hora de desbloqueo
   */
  static async sendAccountBlockedAlert(recipientEmail, recipientUsername, blockedUsername, blockedUntil) {
    const transporter = this.initializeTransporter();

    const untilDate = blockedUntil instanceof Date ? blockedUntil : new Date(blockedUntil);
    const now = new Date();
    const remainingMinutes = Math.max(1, Math.ceil((untilDate.getTime() - now.getTime()) / 60000));
    const unlockAt = untilDate.toLocaleString('es-ES');

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: recipientEmail,
      subject: '🚫 Alerta de Seguridad - Cuenta suspendida temporalmente',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #d93025; margin-bottom: 12px;">
            <img src="cid:logo" alt="Ruedas Industriales Durango" style="max-height: 120px; margin: 0 auto 15px; display: block;" width="180" />
          </div>
          <div style="background-color: #fdecea; padding: 20px; border-radius: 5px; border-left: 5px solid #d93025;">
            <h1 style="color: #8a1c1c;">🚫 Cuenta suspendida temporalmente</h1>
            <p style="color: #8a1c1c; font-size: 16px;">
              Se detectaron múltiples intentos fallidos de inicio de sesión.
            </p>
            <div style="background-color: #fff; padding: 15px; border-radius: 3px; margin: 20px 0; border: 1px solid #f5c2c7;">
              <p style="margin: 5px 0;"><strong>Usuario bloqueado:</strong> <span style="color:#b42318; font-weight:700;">${blockedUsername}</span></p>
              <p style="margin: 5px 0;"><strong>Tiempo restante estimado:</strong> ${remainingMinutes} minuto(s)</p>
              <p style="margin: 5px 0;"><strong>Se desbloquea a las:</strong> ${unlockAt}</p>
            </div>
            <hr style="border: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Este es un correo automático de seguridad. Por favor no respondas a este mensaje.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '../public/images/logo-b.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      const acceptedList = Array.isArray(info.accepted) ? info.accepted.map((v) => String(v).toLowerCase()) : [];
      const target = String(recipientEmail).toLowerCase();

      if (!acceptedList.includes(target)) {
        throw new Error(`SMTP no confirmó entrega al destinatario. accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)}`);
      }

      console.log('[AccountBlockedAlert] sent', {
        to: recipientEmail,
        blockedUsername,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
        messageId: info.messageId
      });

      return { success: true, message: 'Alerta de bloqueo enviada' };
    } catch (error) {
      console.error('Error enviando alerta de bloqueo temporal:', error);
      throw new Error(`Error enviando email: ${error.message}`);
    }
  }

  /**
   * Enviar aviso a administradores cuando una cuenta de empleado fue bloqueada
   * @param {string} adminEmail
   * @param {string} adminUsername
   * @param {string} blockedUsername
   * @param {Date|string} blockedUntil
   */
  static async sendAccountBlockedAdminAlert(adminEmail, adminUsername, blockedUsername, blockedUntil) {
    const transporter = this.initializeTransporter();

    const untilDate = blockedUntil instanceof Date ? blockedUntil : new Date(blockedUntil);
    const unlockAt = untilDate.toLocaleString('es-ES');

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: adminEmail,
      subject: '🚨 Alerta Administrativa - Usuario bloqueado por intentos fallidos',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f97316; margin-bottom: 12px;">
            <img src="cid:logo" alt="Ruedas Industriales Durango" style="max-height: 120px; margin: 0 auto 15px; display: block;" width="180" />
          </div>
          <div style="background-color: #fff7ed; padding: 20px; border-radius: 5px; border-left: 5px solid #f97316;">
            <h1 style="color: #9a3412;">🚨 Aviso para administradores</h1>
            <p style="color: #7c2d12; font-size: 16px;">
              Se bloqueó temporalmente una cuenta por múltiples intentos fallidos de inicio de sesión.
            </p>
            <div style="background-color: #fff; padding: 15px; border-radius: 3px; margin: 20px 0; border: 1px solid #fed7aa;">
              <p style="margin: 5px 0;"><strong>Administrador receptor:</strong> ${adminUsername || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Usuario bloqueado:</strong> <span style="color:#b45309; font-weight:700;">${blockedUsername}</span></p>
              <p style="margin: 5px 0;"><strong>Desbloqueo estimado:</strong> ${unlockAt}</p>
            </div>
            <p style="color: #7c2d12; font-size: 13px;">Verifica si existe actividad sospechosa y toma acciones preventivas si aplica.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '../public/images/logo-b.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('[AccountBlockedAdminAlert] sent', {
        to: adminEmail,
        blockedUsername,
        accepted: info.accepted,
        rejected: info.rejected,
        messageId: info.messageId
      });
      return { success: true, message: 'Alerta a administradores enviada' };
    } catch (error) {
      console.error('Error enviando alerta a administradores:', {
        email: adminEmail,
        error: error.message
      });
      throw new Error(`Error enviando email admin: ${error.message}`);
    }
  }

  /**
   * Enviar una sola notificación (BCC) a todos los administradores activos
   * @param {string[]} adminEmails
   * @param {string} blockedUsername
   * @param {Date|string} blockedUntil
   */
  static async sendAccountBlockedAdminBroadcast(adminEmails, blockedUsername, blockedUntil) {
    const transporter = this.initializeTransporter();

    const uniqueEmails = Array.from(
      new Set((Array.isArray(adminEmails) ? adminEmails : [])
        .map((v) => String(v || '').trim().toLowerCase())
        .filter((v) => v.length > 0))
    );

    if (uniqueEmails.length === 0) {
      return { success: true, acceptedCount: 0, failedCount: 0 };
    }

    const untilDate = blockedUntil instanceof Date ? blockedUntil : new Date(blockedUntil);
    const unlockAt = untilDate.toLocaleString('es-ES');

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      bcc: uniqueEmails,
      subject: '🚨 Alerta Administrativa - Usuario bloqueado por intentos fallidos',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f97316; margin-bottom: 12px;">
            <img src="cid:logo" alt="Ruedas Industriales Durango" style="max-height: 120px; margin: 0 auto 15px; display: block;" width="180" />
          </div>
          <div style="background-color: #fff7ed; padding: 20px; border-radius: 5px; border-left: 5px solid #f97316;">
            <h1 style="color: #9a3412;">🚨 Aviso para administradores</h1>
            <p style="color: #7c2d12; font-size: 16px;">
              Se bloqueó temporalmente una cuenta por múltiples intentos fallidos de inicio de sesión.
            </p>
            <div style="background-color: #fff; padding: 15px; border-radius: 3px; margin: 20px 0; border: 1px solid #fed7aa;">
              <p style="margin: 5px 0;"><strong>Usuario bloqueado:</strong> <span style="color:#b45309; font-weight:700;">${blockedUsername}</span></p>
              <p style="margin: 5px 0;"><strong>Desbloqueo estimado:</strong> ${unlockAt}</p>
              <p style="margin: 5px 0;"><strong>Destinatarios administradores:</strong> ${uniqueEmails.length}</p>
            </div>
            <p style="color: #7c2d12; font-size: 13px;">Verifica si existe actividad sospechosa y toma acciones preventivas si aplica.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '../public/images/logo-b.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      const accepted = Array.isArray(info.accepted) ? info.accepted.map((v) => String(v).toLowerCase()) : [];
      const rejected = Array.isArray(info.rejected) ? info.rejected.map((v) => String(v).toLowerCase()) : [];

      console.log('[AccountBlockedAdminBroadcast] sent', {
        blockedUsername,
        requestedCount: uniqueEmails.length,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        accepted,
        rejected,
        messageId: info.messageId
      });

      return {
        success: true,
        acceptedCount: accepted.length,
        failedCount: Math.max(0, uniqueEmails.length - accepted.length)
      };
    } catch (error) {
      console.error('Error enviando broadcast a administradores:', {
        count: uniqueEmails.length,
        error: error.message
      });
      throw new Error(`Error enviando email admins: ${error.message}`);
    }
  }

   /**
   * Enviar email de reactivación/recuperación de token
   * @param {string} email
   * @param {string} newToken
   */
  static async resendVerificationEmail(email, token) {
    return this.sendVerificationEmail(email, token);
  }

  /**
   * Enviar email para reseteo de contraseña
   * @param {string} email - Email del usuario
   * @param {string} username - Username del usuario
   * @param {string} token - Token de reseteo
   */
  static async sendPasswordResetEmail(email, username, token) {
    const transporter = this.initializeTransporter();
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f97316;">
            <img src="cid:logo" alt="Ruedas Industriales Durango" style="max-height: 120px; margin: 0 auto 15px; display: block;" width="180" />
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h1 style="color: #333;">Restablecer tu Contraseña</h1>
            <p style="color: #666; font-size: 16px;">
              Hola ${username},
            </p>
            <p style="color: #666; font-size: 16px;">
              Hemos recibido una solicitud para restablecer tu contraseña. Si fuiste tú, haz clic en el botón de abajo.
            </p>
            <p style="margin: 20px 0;">
              <a href="${resetLink}" 
                 style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Restablecer Contraseña
              </a>
            </p>
            <p style="color: #999; font-size: 12px;">
              Este link expira en 24 horas.
            </p>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              <strong>Instrucciones manuales:</strong><br>
              Si no puedes hacer clic en el botón, copia y pega este link en tu navegador:<br>
              <code style="background-color: #f0f0f0; padding: 5px; display: block; margin-top: 10px; word-break: break-all;">
                ${resetLink}
              </code>
            </p>
            <hr style="border: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Si no solicitaste un restablecimiento de contraseña, ignora este email. Tu cuenta está segura.
            </p>
            <p style="color: #666; font-size: 12px;">
              Este es un email automático. Por favor no respondas a este mensaje.
            </p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Restablecer tu Contraseña - Sistema de Punto de Venta',
      text: `Solicitud de restablecimiento de contraseña. Abre este link: ${resetLink}`,
      html: htmlBody,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '../public/images/logo-b.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('[PasswordResetEmail] sent with Base64 logo', {
        to: email,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response
      });
      return { success: true, message: 'Email de restablecimiento enviado' };
    } catch (error) {
      console.error('Error enviando email de reseteo:', error);
      throw new Error(`Error enviando email: ${error.message}`);
    }
  }
}

module.exports = EmailService;
