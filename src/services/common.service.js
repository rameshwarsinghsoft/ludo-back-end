const  CrudRepository  = require('../repositories/crud.repository');
const { StatusCodes } = require('http-status-codes');
const { User, Token } = require('../models');
const MailService = require('./nodemailer.service');
const cryptoTokenGenerator = require('../utils/cryptoTokenUtil');
const { ServiceResponse } = require('../utils/Response');
const { CatchError } = require('../utils/Response');

const UserRepository = new CrudRepository(User);
const TokenRepository = new CrudRepository(Token);

class CommonService {
    
    async updateProfile(email, updateData) {
        try {
            const userCheck = await this.userExists(email);
            if (!userCheck.success) {
                return userCheck;
            }

            const updatedUser = await UserRepository.updateBy({ email }, updateData);
            return ServiceResponse(true, StatusCodes.OK, "User profile updated successfully.", updatedUser)
        } catch (error) {
            console.error("Error updating user:", error);
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

}

module.exports = new CommonService();