const express = require('express');
const router = express.Router(); 
const { validateSession } = require('../middleware/auth.middleware');
const controller = require('../controllers/dashboard.controller');

router.get('/', validateSession, controller.dashboardView);

module.exports = router;