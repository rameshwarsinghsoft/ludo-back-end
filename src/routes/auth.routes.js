const express = require('express');
const { login, changePassword, forgotPassword, varifyOTP, setPassword } = require('../controllers/auth.controller');
const { validate, AuthMiddleware } = require('../middlewares')
const { loginSchema, changePasswordSchema, forgetPasswordSchema, varifyOTPSchema, setPasswordSchema } = require('../validations/auth.validation')

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.post('/change-password', validate(changePasswordSchema), AuthMiddleware.verifyToken, changePassword);
router.post('/forgot-password', validate(forgetPasswordSchema), forgotPassword);
router.post('/varify-otp', validate(varifyOTPSchema), varifyOTP);
router.post('/set-password', validate(setPasswordSchema), setPassword);

module.exports = router;