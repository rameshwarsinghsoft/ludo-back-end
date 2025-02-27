const Joi = require('joi');
const { requiredString, requiredNumber, emailField, passwordField, confirmPasswordField } = require('./fieldHelpers');

const loginSchema = {
    body: Joi.object({
        email: emailField(),
        password: requiredString('Password'),
    }),
};

const changePasswordSchema = {
    body: Joi.object({
        current_password: requiredString('Current password'),
        new_password: passwordField('New password'),
        confirm_password: confirmPasswordField('Confirm password', 'new_password'),  // Confirm matches 'new_password'
    }),
};

const forgetPasswordSchema = {
    body: Joi.object({
        email: emailField(),
    }),
};

const verifyOTPSchema = {
    body: Joi.object({
        email: emailField(),
        otp: requiredNumber('OTP'),
    }),
};

const setPasswordSchema = {
    body: Joi.object({
        email: emailField(),
        password: passwordField('Password'),
        confirm_password: confirmPasswordField('Confirm password', 'password'),  // Confirm matches 'password'
    }),
};

module.exports = {
    loginSchema,
    changePasswordSchema,
    forgetPasswordSchema,
    verifyOTPSchema,
    setPasswordSchema
};