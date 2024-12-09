const Joi = require('joi');
const { StatusCodes } = require('http-status-codes');
const { ApiResponse } = require('../utils/Response');

const validateRequest = (schema) => (req, res, next) => {
    const validationErrors = [];

    // Iterate through each source defined in the schema (params, body, files, etc.)
    Object.entries(schema).forEach(([source, rules]) => {
        const data = source === 'files' ? req.files : req[source]; // Handle `files` explicitly
        const { error } = rules.validate(data, { abortEarly: false });
        if (error) {
            validationErrors.push(...error.details.map((err) => `${err.message}`));
        }
    });

    if (validationErrors.length > 0) {
        return ApiResponse(res, StatusCodes.BAD_REQUEST, validationErrors[0]);
    }

    next();
};

module.exports = validateRequest;
