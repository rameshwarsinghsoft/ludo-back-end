const Auth = require('../config/auth');
const  CrudRepository  = require('../repositories/crud.repository');
const { StatusCodes } = require('http-status-codes');
const { User, Token } = require('../models');
const MailService = require('./nodemailer.service');
const cryptoTokenGenerator = require('../utils/cryptoTokenUtil');
const { ServiceResponse } = require('../utils/Response');
const { CatchError } = require('../utils/Response');

const UserRepository = new CrudRepository(User);
const TokenRepository = new CrudRepository(Token);

class AdminService {

    async registerUser(userData) {
        const { name, email, password, device_id, type} = userData;
        try {
            const exists = await this.userExists(email);
            if (exists.success) {
                return ServiceResponse(false, StatusCodes.CONFLICT, 'This email is already registered with another user.')
            }

            const hashedPassword = await Auth.hashPassword(password);

            const newUser = await UserRepository.create({ name, email,  password: hashedPassword, device_id, type })

            // const token = cryptoTokenGenerator();
            // await TokenRepository.create({ email, token });

            // await MailService.createPasswordEmail(email, token)

            return ServiceResponse(true, StatusCodes.CREATED, "User registered successfully", newUser)
        } catch (error) {
            console.error("Error during user registration:", error);
            CatchError(error);
        }
    }

    async getAllUsers(email) {
        try {
            const criteria = email ? { email } : null;
            const users = await UserRepository.find(criteria);
            if (users.length > 0) {
                return ServiceResponse(true, StatusCodes.OK, "Fetched all users successfully.", users)
            } else {
                return ServiceResponse(false, StatusCodes.NOT_FOUND, "No users found.")
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            CatchError(error);
        }
    }

    async userExists(email) {
        const user = await UserRepository.findBy({ email });
        if (!user) {
            return ServiceResponse(false, StatusCodes.NOT_FOUND, "User not found with the provided email ID.")
        }
        return { success: true, user };
    }

    async updateUser(email, updateData) {
        try {
            const userCheck = await this.userExists(email);
            if (!userCheck.success) {
                return userCheck;
            }

            const updatedUser = await UserRepository.updateBy({ email }, updateData);
            return ServiceResponse(true, StatusCodes.OK, "User updated successfully.", updatedUser)
        } catch (error) {
            console.error("Error updating user:", error);
            CatchError(error);
        }
    }

    async toggleUserActiveStatus(email) {
        try {
            const userCheck = await this.userExists(email);
            if (!userCheck.success) {
                return userCheck;
            }
            let {is_active} = await UserRepository.toggleActiveStatus({ email });
            return ServiceResponse(true, StatusCodes.OK, is_active ? "User activated successfully." : "User deactivated successfully.");
        } catch (error) {
            cconsole.error("An error occurred while attempting user activation or deactivation:", error);
            CatchError(error);
        }
    }
    
    async softDeleteUser(email) {
        try {
            const userCheck = await this.userExists(email);
            if (!userCheck.success) {
                return userCheck;
            }
            await UserRepository.softdelete({ email });
            return ServiceResponse(true, StatusCodes.OK, "User has been soft-deleted successfully.");
        } catch (error) {
            console.error("An error occurred while attempting to soft delete the user.", error);
            CatchError(error);
        }
    }

    async deleteUser(email) {
        try {
            const userCheck = await this.userExists(email);
            if (!userCheck.success) {
                return userCheck;
            }
            await UserRepository.deleteOne({ email });
            return ServiceResponse(true, StatusCodes.OK, "User deleted successfully.");
        } catch (error) {
            console.error("Error deleting user:", error);
            CatchError(error);
        }
    }
}

module.exports = new AdminService();