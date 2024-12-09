const express = require('express');
const { login, setPassword, changePassword, forgotPassword } = require('../controllers/auth.controller');
const { validate, AuthMiddleware } = require('../middlewares')
const { loginSchema, setPasswordSchema, changePasswordSchema, forgetPasswordSchema } = require('../validations/auth.validation')

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.post('/set-password', validate(setPasswordSchema), setPassword);
router.post('/change-password', validate(changePasswordSchema), AuthMiddleware.verifyToken, changePassword);
router.post('/forgot-password', validate(forgetPasswordSchema), forgotPassword);

module.exports = router;