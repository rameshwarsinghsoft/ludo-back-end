const { AuthService } = require('../services');
const { ApiResponse } = require('../utils/Response');
const { StatusCodes } = require('http-status-codes');

class AuthController {

    async login(req, res) {
        try {
            const { email, password } = req.body;
            const { success, status, message, data, token } = await AuthService.loginUser(email, password);
            return ApiResponse(res, status, message, success ? data : undefined, success ? token : undefined);
        } catch (error) {

            return ApiResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, error.toString());
        }
    }

    async changePassword(req, res) {
        try {
            const user = req.user;
            const { current_password, new_password, confirm_password } = req.body;
            const { status, message } = await AuthService.updatePassword(user, current_password, new_password, confirm_password);
            return ApiResponse(res, status, message);
        } catch (error) {
            return ApiResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, error.toString())
        }
    }

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const { status, message } = await AuthService.forgetPassword(email);
            return ApiResponse(res, status, message);
        } catch (error) {
            return ApiResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, error.toString())
        }
    }

    async verifyOTP(req, res) {
        const { email, otp } = req.body;
        try {
            const { status, message } = await AuthService.verifyOTP(email, otp);
            return ApiResponse(res, status, message);
        } catch (error) {
            return ApiResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, error.toString())
        }
    }

    async setPassword(req, res) {
        const { email, password, confirm_password } = req.body;
        try {
            const { status, message } = await AuthService.setPassword(email, password, confirm_password);
            return ApiResponse(res, status, message);
        } catch (error) {
            return ApiResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, error.toString())
        }
    }
}

module.exports = new AuthController();