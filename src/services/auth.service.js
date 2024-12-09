const { User, Token } = require('../models');
const { StatusCodes } = require('http-status-codes');
const  CrudRepository  = require('../repositories/crud.repository');
const MailService = require('./nodemailer.service');
const Auth = require('../config/auth');
const cryptoTokenGenerator = require('../utils/cryptoTokenUtil');
const { ServiceResponse } = require('../utils/Response');
const {CatchError} = require('../utils/Response');

const TokenRepository = new CrudRepository(Token);
const UserRepository = new CrudRepository(User);

class AuthService {

    async loginUser(email, password) {
        try {
            const user = await UserRepository.findBy({ email });
            if (!user) {
                return ServiceResponse(false, StatusCodes.UNAUTHORIZED, "The username or password you entered is incorrect.")
            }

            const isPasswordValid = await Auth.comparePasswords(password, user.password);
            if (isPasswordValid) {
                let userData = {
                    _id: user._id,
                    // name: user.name,
                    email: user.email
                };
                const token = Auth.generateToken(userData);
                return ServiceResponse(true, StatusCodes.OK, "User logged in successfully.", user, token);
            }
            return ServiceResponse(false, StatusCodes.UNAUTHORIZED,  "The username or password you entered is incorrect.");
        } catch (error) {
            console.error(`Error during user login for email ${email}:`, error);
            CatchError(`Error during user login: ${error}`);
        }
    }

    async setPassword(email, token, password, confirm_password) {
        try {
            const user = await UserRepository.findBy({ email });
            if (!user) {
                return ServiceResponse(false, StatusCodes.NOT_FOUND, "No user found with the provided email ID.");
            }

            const findToken = await TokenRepository.findBy({ token });
            if (!findToken) {
                return ServiceResponse(false, StatusCodes.NOT_FOUND, "Token has expired. Please request a new token link.");
            }

            if (password !== confirm_password) {
                return ServiceResponse(false, StatusCodes.BAD_REQUEST, "Password and confirm password must match.");
            }

            const hashedNewPassword = await Auth.hashPassword(password);
            user.password = hashedNewPassword;
            await UserRepository.save(user);
            await TokenRepository.deleteOne({ token });

            return ServiceResponse(true, StatusCodes.OK,  "Password created successfully. You can now log in with your new password.");
        } catch (error) {
            console.error("Error updating password:", error);
            CatchError(`An error occurred while creating the password: ${error}`);
        }
    }

    async updatePassword(auth_user, currentPassword, newPassword, confirmPassword) {
        try {
            const isPasswordValid = await Auth.comparePasswords(currentPassword, auth_user.password);
            // If current password is incorrect
            if (!isPasswordValid) {
                return ServiceResponse(false, StatusCodes.UNAUTHORIZED,  "Incorrect current password.");
            }

            if (currentPassword === newPassword) {
                return ServiceResponse(false, StatusCodes.BAD_REQUEST, "New password must be different from the current password");
            }
            
            if (newPassword !== confirmPassword) {
                return ServiceResponse(false, StatusCodes.BAD_REQUEST,  "New password and confirm password must match.");
            }

            const hashedNewPassword = await Auth.hashPassword(newPassword);

            let user = await UserRepository.findBy({ email: auth_user.email });
            if (!user) {
                return ServiceResponse(false, StatusCodes.NOT_FOUND,  "User not found.");
            }

            user.password = hashedNewPassword;
            await UserRepository.save(user);
            return ServiceResponse(true, StatusCodes.OK,  "Password updated successfully.");
            
        } catch (error) {
            console.error("An error occurred while changing the password.:", error);
            CatchError(`An error occurred while changing the password : ${error}`);
        }
    }

    async forgetPassword(email) {
        try {
            const user = await UserRepository.findBy({ email });

            if (!user) {
                return ServiceResponse(false, StatusCodes.NOT_FOUND,   "No user found with the provided email ID.");
            }

            // generate token
            const token = cryptoTokenGenerator();

            const existingToken = await TokenRepository.findBy({ email });
            if (existingToken) {
                console.log("existingToken : ",existingToken)
                existingToken.token = token;
                await TokenRepository.save(existingToken)
            } else {
                console.log("Not existingToken : ",existingToken)
                await TokenRepository.create({ email, token })
            }
            let { success, status, message } = await MailService.sendForgotPasswordEmail(email, token)
            console.log( success, status, message)
            return ServiceResponse(success, status,message);
        } catch (error) {
            console.error(`Error during forget password:`, error.message);
            CatchError(`Error during forget password: ${error}`);
        }
    }

}
module.exports = new AuthService();