const { CommonService } = require('../services');
const { ApiResponse } = require('../utils/Response');
const { StatusCodes } = require('http-status-codes');

class CommonController {

    async updateProfile(req, res) {
        try {
            const email = req.params.email;
            const { name, mobile_number, address_details, identification } = req.body;
            const uploadedFiles = req.files;
            const savedData = {};

            Object.keys(uploadedFiles).forEach(key => {
                const file = uploadedFiles[key][0];
                savedData[key] = `/uploads/${file.filename}`;
            });

            const identificationData = {
                aadhaar_card_file: savedData['identification[aadhaar_card_file]'],
                pan_card_file: savedData['identification[pan_card_file]'],
                profile_image: savedData['profile_image'],
            };

            // Update identification with the new file URLs
            identification.profile_image = identificationData.profile_image;
            identification.aadhaar_card_file = identificationData.aadhaar_card_file;
            identification.pan_card_file = identificationData.pan_card_file;

            const user = await CommonService.updateProfile(email, { name, mobile_number, address_details, identification });
            return ApiResponse(res, user.status, user.message, user.success ? user.data : undefined);
        } catch (error) {
            return ApiResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, error.toString());
        }
    }
}

module.exports = new CommonController();