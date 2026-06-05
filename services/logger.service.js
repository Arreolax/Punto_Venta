const fs = require('fs');
const path = require('path');

class LoggerService {
  /**
   * Directorio base de logs
   */
  static logsDir = path.join(__dirname, '../logs');

  /**
   * Inicializar estructura de directorios
   */
  static initializeDirectories() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Crear subdirectorios por módulo
    const modules = ['auth', 'api', 'errors', 'activity'];
    modules.forEach(module => {
      const moduleDir = path.join(this.logsDir, module);
      if (!fs.existsSync(moduleDir)) {
        fs.mkdirSync(moduleDir, { recursive: true });
      }
    });
  }

  /**
   * Obtener nombre de archivo con fecha
   * @param {string} module - Módulo (auth, api, errors, activity)
   * @returns {string} ruta completa del archivo
   */
  static getLogFilePath(module = 'general') {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const filename = `${year}-${month}-${day}.log`;

    const moduleDir = path.join(this.logsDir, module);
    return path.join(moduleDir, filename);
  }

  /**
   * Formatear mensaje de log
   * @param {string} level - Nivel (INFO, ERROR, WARN, DEBUG)
   * @param {string} message - Mensaje
   * @param {object} data - Datos adicionales (opcional)
   * @returns {string} mensaje formateado
   */
  static formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;

    if (data) {
      logMessage += ` | DATA: ${JSON.stringify(data)}`;
    }

    return logMessage;
  }

  /**
   * Escribir en archivo de log
   * @param {string} level - Nivel (INFO, ERROR, WARN, DEBUG)
   * @param {string} message - Mensaje
   * @param {string} module - Módulo
   * @param {object} data - Datos adicionales
   */
  static writeLog(level, message, module = 'general', data = null) {
    try {
      const filePath = this.getLogFilePath(module);
      const formattedMessage = this.formatMessage(level, message, data);

      fs.appendFileSync(filePath, formattedMessage + '\n', 'utf8');

      // También imprimir en consola
      console.log(formattedMessage);
    } catch (error) {
      console.error('Error writing log:', error);
    }
  }

  /**
   * Log de información
   */
  static info(message, module = 'general', data = null) {
    this.writeLog('INFO', message, module, data);
  }

  /**
   * Log de error
   */
  static error(message, module = 'general', data = null) {
    this.writeLog('ERROR', message, module, data);
  }

  /**
   * Log de advertencia
   */
  static warn(message, module = 'general', data = null) {
    this.writeLog('WARN', message, module, data);
  }

  /**
   * Log de debug
   */
  static debug(message, module = 'general', data = null) {
    this.writeLog('DEBUG', message, module, data);
  }

  /**
   * Log de actividad de usuario
   */
  static activity(action, userId, username, module, details = null) {
    const activityMessage = `USER_ACTION: ${action} | UserID: ${userId} | Username: ${username} | Module: ${module}`;
    this.writeLog('ACTIVITY', activityMessage, 'activity', {
      action,
      userId,
      username,
      module,
      details
    });
  }

  /**
   * Log de autenticación
   */
  static auth(message, username = null, data = null) {
    const authMessage = username ? `${message} | Username: ${username}` : message;
    this.writeLog('AUTH', authMessage, 'auth', data);
  }

  /**
   * Leer logs de un módulo para un día específico
   * @param {string} module - Módulo
   * @param {string} date - Fecha en formato YYYY-MM-DD (opcional, default: hoy)
   * @returns {string} contenido del archivo de log
   */
  static readLogs(module = 'general', date = null) {
    try {
      const logDate = date || new Date().toISOString().split('T')[0];
      const filename = `${logDate}.log`;
      const filePath = path.join(this.logsDir, module, filename);

      if (!fs.existsSync(filePath)) {
        return `No logs found for ${module} on ${logDate}`;
      }

      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      return `Error reading logs: ${error.message}`;
    }
  }

  /**
   * Limpiar logs antiguos (más de N días)
   * @param {number} daysToKeep - Días a mantener (default: 30)
   */
  static cleanOldLogs(daysToKeep = 30) {
    try {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const cutoffTime = now - daysPerDay * daysToKeep;

      const walkDir = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);

          if (stat.isFile() && file.endsWith('.log')) {
            if (stat.mtime.getTime() < cutoffTime) {
              fs.unlinkSync(filePath);
              console.log(`[LOG CLEANUP] Deleted: ${filePath}`);
            }
          } else if (stat.isDirectory()) {
            walkDir(filePath);
          }
        });
      };

      walkDir(this.logsDir);
    } catch (error) {
      console.error('Error cleaning old logs:', error);
    }
  }
}

// Inicializar directorios al cargar el módulo
LoggerService.initializeDirectories();

module.exports = LoggerService;
