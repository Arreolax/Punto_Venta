-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 05-06-2026 a las 00:55:18
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `punto_venta`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'Usuario que realizó la acción',
  `action` varchar(100) NOT NULL COMMENT 'Acción realizada (crear, editar, eliminar, etc.)',
  `module` varchar(50) DEFAULT NULL COMMENT 'Módulo donde se realizó la acción',
  `details` text DEFAULT NULL COMMENT 'Detalles adicionales de la acción',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro de actividades realizadas por cada usuario (solo visible para Administrador)';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Nombre de la categoría',
  `description` text DEFAULT NULL COMMENT 'Descripción de la categoría',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Categorías para clasificar y filtrar productos';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cfdi_uses`
--

CREATE TABLE `cfdi_uses` (
  `id` int(11) NOT NULL,
  `code` varchar(10) NOT NULL COMMENT 'Código del uso CFDI (ej: G01)',
  `name` varchar(100) NOT NULL COMMENT 'Nombre descriptivo',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Si está activo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de usos de CFDI del SAT (ID y nombre)';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `clients`
--

CREATE TABLE `clients` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL COMMENT 'Nombre completo o razón social',
  `email` varchar(100) DEFAULT NULL COMMENT 'Correo electrónico',
  `phone` varchar(20) DEFAULT NULL COMMENT 'Teléfono de contacto',
  `address` text DEFAULT NULL COMMENT 'Dirección del cliente',
  `postal_code` varchar(10) DEFAULT NULL COMMENT 'Código postal del cliente',
  `tax_regime` varchar(10) DEFAULT NULL COMMENT 'Regimen fiscal del cliente',
  `rfc` varchar(20) DEFAULT NULL COMMENT 'RFC del cliente (requerido para facturación)',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Base de datos de clientes para reutilizar en ventas y facturas';

-- --------------------------------------------------------

--
-- Volcado de datos para la tabla `clients`
--
INSERT INTO `clients` (`id`, `name`, `email`, `phone`, `address`, `postal_code`, `tax_regime`, `rfc`) 
VALUES(1, 'Publico en General', 'publico@demo.com', '0000000000', 'SIN DIRECCION', '00000', '616', 'XAXX010101000');

--
-- Estructura de tabla para la tabla `express_sessions`
--

CREATE TABLE `express_sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `folio`
--

CREATE TABLE `folio` (
  `id_folio` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL COMMENT 'Venta asociada',
  `ticket_id` int(11) NOT NULL COMMENT 'Ticket generado',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabla de folios del día (se resetea diariamente con TRUNCATE)';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `historial_permanente`
--

CREATE TABLE `historial_permanente` (
  `id` int(11) NOT NULL,
  `folio` int(11) NOT NULL COMMENT 'Número de folio que tuvo ese día',
  `sale_id` int(11) NOT NULL COMMENT 'Venta asociada',
  `ticket_id` int(11) NOT NULL COMMENT 'Ticket asociado',
  `user_id` int(11) NOT NULL COMMENT 'Usuario que generó',
  `total` decimal(10,2) NOT NULL COMMENT 'Total de la venta (copia para historial)',
  `payment_method` varchar(20) NOT NULL COMMENT 'Método de pago usado',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historial permanente de todos los tickets (nunca se borra)';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `inventory_movements`
--

CREATE TABLE `inventory_movements` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL COMMENT 'Producto involucrado',
  `user_id` int(11) NOT NULL COMMENT 'Usuario que realizó el movimiento',
  `movement_type` enum('entrada','salida') NOT NULL COMMENT 'Tipo de movimiento',
  `reason` enum('compra','devolución','venta','eliminación','devolución_proveedor') NOT NULL COMMENT 'Motivo del movimiento',
  `quantity` int(11) NOT NULL COMMENT 'Cantidad movida',
  `support_document` varchar(255) DEFAULT NULL COMMENT 'Ruta/referencia del documento de soporte (opcional)',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historial completo de entradas y salidas de inventario';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `invoices`
--

CREATE TABLE `invoices` (
  `id` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL COMMENT 'Venta asociada (1 factura por venta)',
  `client_id` int(11) NOT NULL COMMENT 'Cliente de la factura',
  `user_id` int(11) NOT NULL COMMENT 'Usuario que generó la factura',
  `facturama_id` varchar(100) NOT NULL COMMENT 'ID de Facturama',
  `facturama_folio` varchar(11) NOT NULL COMMENT 'Folio de Facturama',
  `cfdi_use` varchar(11) NOT NULL COMMENT 'Uso del CFDI seleccionado',
  `payment_method` enum('contado','plazo') DEFAULT 'contado' COMMENT 'Forma de pago',
  `subtotal` decimal(10,2) NOT NULL COMMENT 'Subtotal sin IVA',
  `tax_amount` decimal(10,2) NOT NULL COMMENT 'Monto de IVA',
  `total` decimal(10,2) NOT NULL COMMENT 'Total de la factura',
  `status` enum('timbrada','cancelada','borrador') DEFAULT 'borrador' COMMENT 'Estado actual',
  `uuid` varchar(50) DEFAULT NULL COMMENT 'UUID del SAT tras timbrado',
  `currency` varchar(10) NOT NULL COMMENT 'Moneda de la factura',
  `receipt_type` varchar(10) NOT NULL COMMENT 'Tipo de comprobante',
  `receipt_method` varchar(10) NOT NULL COMMENT 'Metodo de pago',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Facturas CFDI generadas';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `invoice_items`
--

CREATE TABLE `invoice_items` (
  `id` int(11) NOT NULL,
  `invoice_id` int(11) NOT NULL COMMENT 'Factura a la que pertenece',
  `product_id` int(11) NOT NULL COMMENT 'Producto asociado',
  `product_name` varchar(150) NOT NULL COMMENT 'Nombre del producto',
  `description` text DEFAULT NULL COMMENT 'Descripción del concepto',
  `quantity` int(11) NOT NULL COMMENT 'Cantidad',
  `unit_price` decimal(10,2) NOT NULL COMMENT 'Precio unitario',
  `subtotal` decimal(10,2) NOT NULL COMMENT 'Subtotal del concepto'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Conceptos/productos dentro de cada factura';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `permissions`
--

CREATE TABLE `permissions` (
  `id` int(11) NOT NULL,
  `name` varchar(80) NOT NULL COMMENT 'Nombre del permiso (ej: crear_producto)',
  `module` varchar(50) DEFAULT NULL COMMENT 'Módulo al que pertenece el permiso',
  `description` text DEFAULT NULL COMMENT 'Descripción de lo que permite hacer'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de permisos disponibles en el sistema';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `ref_producto` varchar(50) NOT NULL COMMENT 'Referencia/clave única del producto (asignada por Admin)',
  `etiqueta` varchar(150) NOT NULL COMMENT 'Etiqueta/nombre del producto',
  `categoria_id` int(11) DEFAULT NULL COMMENT 'Categoría del producto',
  `sat_unidad_id` int(11) DEFAULT NULL COMMENT 'Clave de Unidad de SAT para facturación CFDI',
  `clave_sat` int(11) DEFAULT NULL COMMENT 'Clave de SAT del producto',
  `precio_venta` decimal(10,2) NOT NULL COMMENT 'Precio de venta del producto (IVA incluido)',
  `mejor_precio_compra` decimal(10,2) DEFAULT NULL COMMENT 'Mejor precio de compra registrado',
  `stock_deseado` int(11) DEFAULT 20 COMMENT 'Stock deseado/objetivo para el producto',
  `stock_fisico` int(11) DEFAULT 0 COMMENT 'Cantidad física disponible actual',
  `estado_venta` enum('En venta','Pausado') DEFAULT 'En venta' COMMENT 'Estado del producto para venta',
  `estado_compra` enum('En compra','Pausado') DEFAULT 'En compra' COMMENT 'Estado del producto para compra',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Si el producto está activo en el sistema',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `descripcion_breve` varchar(255) DEFAULT NULL COMMENT 'Descripción breve del producto'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Almacena todos los productos del inventario';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL COMMENT 'Nombre del rol (Administrador / Empleado)',
  `description` text DEFAULT NULL COMMENT 'Descripción del rol y sus alcances',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Define los tipos de rol disponibles';

--
-- Volcado de datos para la tabla `roles`
--

INSERT INTO `roles` (`id`, `name`, `description`, `created_at`) VALUES
(1, 'Administrador', 'Acceso total al sistema', '2026-03-02 17:37:32');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `role_permissions`
--

CREATE TABLE `role_permissions` (
  `id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL COMMENT 'Rol asociado',
  `permission_id` int(11) NOT NULL COMMENT 'Permiso asociado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Relación N:M entre roles y permisos';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sales`
--

CREATE TABLE `sales` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'Empleado que realizó la venta',
  `client_id` int(11) DEFAULT NULL COMMENT 'Cliente asociado (nullable)',
  `total` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Total de la venta',
  `payment_method` enum('efectivo','transferencia','tarjeta') NOT NULL COMMENT 'Método de pago',
  `cash_received` decimal(10,2) DEFAULT NULL COMMENT 'Monto recibido en efectivo (si aplica)',
  `change_given` decimal(10,2) DEFAULT NULL COMMENT 'Cambio devuelto',
  `sale_type` varchar(100) DEFAULT 'Público en general',
  `status` enum('completada','cancelada','pendiente') DEFAULT 'completada',
  `payment_reference` varchar(100) DEFAULT NULL COMMENT 'Código/referencia de pago',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registra cada transacción de venta completa';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sale_items`
--

CREATE TABLE `sale_items` (
  `id` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL COMMENT 'Venta a la que pertenece',
  `product_id` int(11) NOT NULL COMMENT 'Producto vendido',
  `product_name` varchar(150) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `quantity` int(11) NOT NULL COMMENT 'Cantidad vendida',
  `unit_price` decimal(10,2) NOT NULL COMMENT 'Precio unitario al momento de venta',
  `subtotal` decimal(10,2) NOT NULL COMMENT 'Subtotal (cantidad × precio)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Detalle de productos vendidos en cada venta';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sat_unidades`
--

CREATE TABLE `sat_unidades` (
  `id` int(11) NOT NULL,
  `clave` varchar(10) NOT NULL COMMENT 'Clave SAT de la unidad (ej: H87)',
  `descripcion` varchar(100) NOT NULL COMMENT 'Descripción de la unidad (ej: Pieza)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de claves de unidad del SAT';

-- --------------------------------------------------------

--
-- Volcado de datos para la tabla `sat_unidades`
--

INSERT INTO `sat_unidades` (`id`, `clave`, `descripcion`) VALUES
(1, 'H87', 'Pieza'),
(2, 'E48', 'Unidad de servicio'),
(3, 'ACT', 'Actividad'),
(4, 'KGM', 'Kilogramo'),
(5, 'LTR', 'Litro'),
(6, 'MTR', 'Metro'),
(7, 'MTK', 'Metro cuadrado'),
(8, 'MTQ', 'Metro cúbico'),
(9, 'C62', 'Uno (unidad genérica)');

--
-- Estructura de tabla para la tabla `sessions`
--

CREATE TABLE `sessions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'Usuario de la sesión',
  `token` varchar(255) NOT NULL COMMENT 'Token de sesión (JWT o similar)',
  `last_activity` datetime DEFAULT current_timestamp() COMMENT 'Último momento de actividad del usuario',
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'Fecha de inicio de sesión',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Si la sesión sigue activa'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Gestiona las sesiones activas (cierre automático tras 2 horas de inactividad)';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tickets`
--

CREATE TABLE `tickets` (
  `id` int(11) NOT NULL,
  `ticket_number` varchar(30) NOT NULL COMMENT 'Número único e irrepetible del ticket',
  `sale_id` int(11) NOT NULL COMMENT 'Venta asociada al ticket',
  `user_id` int(11) NOT NULL COMMENT 'Usuario que generó el ticket',
  `company_name` varchar(100) DEFAULT 'NOMBRE EMPRESA' COMMENT 'Nombre comercial de la empresa',
  `company_phone` varchar(20) DEFAULT '618 218 8982' COMMENT 'Número de contacto de la empresa',
  `company_logo_path` varchar(255) DEFAULT '/images/logo-b_w.png' COMMENT 'Ruta de la imagen del logotipo',
  `commercial_message` text DEFAULT NULL COMMENT 'Mensaje comercial configurable',
  `printed_at` datetime DEFAULT NULL COMMENT 'Fecha/hora de impresión (nullable si no se ha imprimido)',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Almacena cada ticket de venta generado';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ticket_items`
--

CREATE TABLE `ticket_items` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL COMMENT 'Ticket al que pertenece',
  `product_id` int(11) NOT NULL COMMENT 'Producto asociado',
  `product_name` varchar(150) NOT NULL COMMENT 'Nombre del producto al momento de la venta',
  `description` text DEFAULT NULL COMMENT 'Descripción breve del producto',
  `quantity` int(11) NOT NULL COMMENT 'Cantidad vendida',
  `unit_price` decimal(10,2) NOT NULL COMMENT 'Precio unitario',
  `subtotal` decimal(10,2) NOT NULL COMMENT 'Subtotal del item'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Detalle de productos en cada ticket';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL COMMENT 'Nombre de usuario único para login',
  `name` varchar(50) NOT NULL COMMENT 'Nombre del usuario',
  `last_name` varchar(50) NOT NULL COMMENT 'Apellidos del usuario',
  `email` varchar(100) DEFAULT NULL COMMENT 'Correo electrónico (requerido para Administrador)',
  `phone` varchar(20) DEFAULT NULL COMMENT 'Teléfono de contacto del usuario',
  `password_hash` varchar(255) NOT NULL COMMENT 'Contraseña encriptada',
  `job_position` varchar(100) DEFAULT NULL COMMENT 'Puesto de trabajo o posición del usuario',
  `birth_date` date DEFAULT NULL COMMENT 'Fecha de nacimiento del usuario',
  `role_id` int(11) NOT NULL COMMENT 'Rol asignado al usuario',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Estado activo/inactivo de la cuenta',
  `is_verified` tinyint(1) DEFAULT 1 COMMENT 'Si el email fue verificado (importante para Administrador)',
  `is_blocked` tinyint(1) DEFAULT 0 COMMENT 'Si la cuenta está bloqueada por intentos fallidos',
  `blocked_until` datetime DEFAULT NULL COMMENT 'Fecha/hora hasta la cual está bloqueado',
  `failed_attempts` int(11) DEFAULT 0 COMMENT 'Contador de intentos fallidos consecutivos',
  `individual_permissions` longtext NOT NULL DEFAULT '{}' COMMENT 'Permisos individuales del usuario (JSON)',
  `profile_image_path` varchar(255) DEFAULT NULL COMMENT 'Ruta de la imagen de perfil del usuario',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Almacena los datos de cada usuario del sistema';

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `username`, `name`, `last_name`, `email`, `phone`, `password_hash`, `job_position`, `birth_date`, `role_id`, `is_active`, `is_verified`, `is_blocked`, `blocked_until`, `failed_attempts`, `individual_permissions`, `profile_image_path`, `created_at`, `updated_at`) VALUES
(1, 'admin', 'User', 'Admin', 'admin@admin.com', '+526189999999', '$2a$05$03FRGfhEwXfosqq3m2qOau4xIoaBOW195jzPO534NhdM6ZtfgNPIS', 'admin', '2000-06-04', 1, 1, 1, 0, NULL, 0, '{}', NULL, '2026-06-04 16:51:48', '2026-06-04 16:53:22');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `user_roles`
--

CREATE TABLE `user_roles` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'Usuario asociado',
  `role_id` int(11) NOT NULL COMMENT 'Rol asignado',
  `assigned_at` datetime DEFAULT current_timestamp() COMMENT 'Fecha de asignación del rol'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Asigna un rol único a cada usuario';

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_module` (`module`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indices de la tabla `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`);

--
-- Indices de la tabla `cfdi_uses`
--
ALTER TABLE `cfdi_uses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_code` (`code`);

--
-- Indices de la tabla `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `rfc` (`rfc`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_rfc` (`rfc`);

--
-- Indices de la tabla `express_sessions`
--
ALTER TABLE `express_sessions`
  ADD PRIMARY KEY (`session_id`);

--
-- Indices de la tabla `folio`
--
ALTER TABLE `folio`
  ADD PRIMARY KEY (`id_folio`),
  ADD UNIQUE KEY `sale_id` (`sale_id`),
  ADD UNIQUE KEY `ticket_id` (`ticket_id`),
  ADD KEY `idx_sale` (`sale_id`),
  ADD KEY `idx_ticket` (`ticket_id`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indices de la tabla `historial_permanente`
--
ALTER TABLE `historial_permanente`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_folio` (`folio`),
  ADD KEY `idx_sale` (`sale_id`),
  ADD KEY `idx_ticket` (`ticket_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indices de la tabla `inventory_movements`
--
ALTER TABLE `inventory_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_product` (`product_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_type` (`movement_type`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indices de la tabla `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sale_id` (`sale_id`),
  ADD KEY `idx_sale` (`sale_id`),
  ADD KEY `idx_client` (`client_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_uuid` (`uuid`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indices de la tabla `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_invoice` (`invoice_id`),
  ADD KEY `idx_product` (`product_id`);

--
-- Indices de la tabla `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_module` (`module`);

--
-- Indices de la tabla `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ref_producto` (`ref_producto`),
  ADD KEY `idx_ref` (`ref_producto`),
  ADD KEY `idx_etiqueta` (`etiqueta`),
  ADD KEY `idx_categoria` (`categoria_id`),
  ADD KEY `idx_stock` (`stock_fisico`),
  ADD KEY `fk_products_sat_unidad` (`sat_unidad_id`);

--
-- Indices de la tabla `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`);

--
-- Indices de la tabla `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_role_permission` (`role_id`,`permission_id`),
  ADD KEY `idx_role` (`role_id`),
  ADD KEY `idx_permission` (`permission_id`);

--
-- Indices de la tabla `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_client` (`client_id`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indices de la tabla `sale_items`
--
ALTER TABLE `sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sale` (`sale_id`),
  ADD KEY `idx_product` (`product_id`);

--
-- Indices de la tabla `sat_unidades`
--
ALTER TABLE `sat_unidades`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_clave` (`clave`);

--
-- Indices de la tabla `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indices de la tabla `tickets`
--
ALTER TABLE `tickets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ticket_number` (`ticket_number`),
  ADD KEY `idx_ticket_number` (`ticket_number`),
  ADD KEY `idx_sale` (`sale_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indices de la tabla `ticket_items`
--
ALTER TABLE `ticket_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ticket` (`ticket_id`),
  ADD KEY `idx_product` (`product_id`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_role` (`role_id`);

--
-- Indices de la tabla `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_role` (`user_id`,`role_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_role` (`role_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `cfdi_uses`
--
ALTER TABLE `cfdi_uses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `clients`
--
ALTER TABLE `clients`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `folio`
--
ALTER TABLE `folio`
  MODIFY `id_folio` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `historial_permanente`
--
ALTER TABLE `historial_permanente`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `inventory_movements`
--
ALTER TABLE `inventory_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `invoice_items`
--
ALTER TABLE `invoice_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `role_permissions`
--
ALTER TABLE `role_permissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `sales`
--
ALTER TABLE `sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `sale_items`
--
ALTER TABLE `sale_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `sat_unidades`
--
ALTER TABLE `sat_unidades`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `sessions`
--
ALTER TABLE `sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;


--
-- AUTO_INCREMENT de la tabla `tickets`
--
ALTER TABLE `tickets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `ticket_items`
--
ALTER TABLE `ticket_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `user_roles`
--
ALTER TABLE `user_roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `fk_activity_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `folio`
--
ALTER TABLE `folio`
  ADD CONSTRAINT `fk_folio_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_folio_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `historial_permanente`
--
ALTER TABLE `historial_permanente`
  ADD CONSTRAINT `fk_historial_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_historial_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_historial_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `inventory_movements`
--
ALTER TABLE `inventory_movements`
  ADD CONSTRAINT `fk_inventory_movements_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inventory_movements_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `fk_invoices_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_invoices_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_invoices_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD CONSTRAINT `fk_invoice_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_invoice_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_category` FOREIGN KEY (`categoria_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_products_sat_unidad` FOREIGN KEY (`sat_unidad_id`) REFERENCES `sat_unidades` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `fk_sales_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sales_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `sale_items`
--
ALTER TABLE `sale_items`
  ADD CONSTRAINT `fk_sale_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sale_items_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `sessions`
--
ALTER TABLE `sessions`
  ADD CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `tickets`
--
ALTER TABLE `tickets`
  ADD CONSTRAINT `fk_tickets_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_tickets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `ticket_items`
--
ALTER TABLE `ticket_items`
  ADD CONSTRAINT `fk_ticket_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ticket_items_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
