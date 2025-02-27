const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { StatusCodes } = require('http-status-codes');
const { ApiResponse } = require('../utils/Response');

class AuthMiddleware {
    
    async verifyToken(req, res, next) {
        try {
            if (!req || !req.headers || !res) {
                return ApiResponse(res, StatusCodes.FORBIDDEN, 'Request or Response object is not available.');
            }
            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) {
                return ApiResponse(res, StatusCodes.FORBIDDEN, 'Authentication token not provided.');
            }
            jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
                if (err) {
                    return ApiResponse(res, StatusCodes.UNAUTHORIZED, 'Unauthorized: Missing, invalid, or expired authentication token.');
                }

                const user = await User.findOne({ email: decoded.email });
                if (!user) {
                    return ApiResponse(res, StatusCodes.UNAUTHORIZED, 'User not found.');
                }
                req.user = user;
                next();
            });
        } catch (error) {
            return ApiResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, error.message || error.toString());
        }
    }
}

module.exports = new AuthMiddleware();