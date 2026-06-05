const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Configuración de almacenamiento para multer
 * Guarda las imágenes en /public/images/users/ con nombre: userId_timestamp.ext
 */
const uploadDir = path.join(__dirname, '../public/images/users');

// Crear directorio si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Obtener userId del usuario (debe estar en sesión)
    const userId = req.session?.user?.id || req.user?.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${userId}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

/**
 * Filtro de archivos: solo permite jpg, jpeg, png
 */
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png'];
  const allowedExts = ['.jpg', '.jpeg', '.png'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos JPG, JPEG y PNG'));
  }
};

/**
 * Configuración de multer
 * - Límite de tamaño: 5MB (5 * 1024 * 1024 bytes)
 * - Campo acepta un archivo de nombre "profileImage"
 * - Validación de tipo MIME
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

/**
 * Middleware de error personalizado para multer
 * Maneja errores de tamaño, tipo, etc.
 */
const uploadErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es muy grande. Máximo permitido: 5MB'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Campo de archivo inesperado'
      });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Error al procesar la imagen'
    });
  }
  next();
};

/**
 * Función auxiliar: Eliminar imagen anterior
 * @param {string} imagePath - Ruta relativa como se guarda en BD (ej: /images/users/1_123456.jpg)
 */
const deleteOldImage = (imagePath) => {
  if (!imagePath) return;
  
  try {
    const relativeImagePath = imagePath.replace(/^[/\\]+/, '');
    const fullPath = path.join(__dirname, '../public', relativeImagePath);
    const normalizedFullPath = path.normalize(fullPath);
    const normalizedUploadDir = path.normalize(uploadDir + path.sep);

    // Evita eliminar archivos fuera de /public/images/users.
    if (!normalizedFullPath.startsWith(normalizedUploadDir)) {
      return;
    }

    if (fs.existsSync(normalizedFullPath)) {
      fs.unlinkSync(normalizedFullPath);
    }
  } catch (err) {
    console.error(`Error al eliminar imagen anterior: ${imagePath}`, err);
    // No lanzar error - el proceso de actualización continúa
  }
};

module.exports = {
  upload,
  uploadErrorHandler,
  deleteOldImage,
  uploadDir
};
