const express = require('express');
const { login, changePassword, forgotPassword, verifyOTP, setPassword } = require('../controllers/auth.controller');
const { validate, AuthMiddleware } = require('../middlewares')
const { loginSchema, changePasswordSchema, forgetPasswordSchema, verifyOTPSchema, setPasswordSchema } = require('../validations/auth.validation')

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.post('/change-password', validate(changePasswordSchema), AuthMiddleware.verifyToken, changePassword);
router.post('/forgot-password', validate(forgetPasswordSchema), forgotPassword);
router.post('/verify-otp', validate(verifyOTPSchema), verifyOTP);
router.post('/set-password', validate(setPasswordSchema), setPassword);

module.exports = router;