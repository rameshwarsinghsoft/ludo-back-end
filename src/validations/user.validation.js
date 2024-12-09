const Joi = require('joi');
const { requiredString, requiredNumber, emailFieldOptional, emailField, passwordField, confirmPasswordField, nameField, mobileNumberField, aadhaarNumberField, panNumberField, imageField } = require('./fieldHelpers');

const registerSchema = {
    body: Joi.object({
        name: nameField(),
        email: emailField(),
        password: passwordField('Password'),
        confirm_password: confirmPasswordField('Confirm password', 'password'),
        device_id: requiredString("device_id"),
        type: requiredString("type")
    }).unknown(true),
};

const getUserSchema = {
    params: Joi.object({
        email: emailFieldOptional(),
    }),
};

const updateUserSchema = {
    params: Joi.object({
        email: emailField(),
    }),
    body: Joi.object({
        name: nameField(),
        email: emailField(),
    }),
};

const deleteUserSchema = {
    params: Joi.object({
        email: emailField(),
    }),
};

// Profile Image
const profileImageValidation = (file_var_name, fileName) => Joi.array()
    .items(
        Joi.object({
            fieldname: Joi.string().valid(file_var_name).required().messages({
                'any.required': `${fileName} field name is required`,
            }),
            originalname: Joi.string().required().messages({
                'any.required': `${fileName} original name is required`,
            }),
            mimetype: Joi.string()
                .valid('image/jpeg', 'image/png')
                .required()
                .messages({
                    'any.required': `${fileName} type is required`,
                    'string.valid': `${fileName} must be a JPEG or PNG image`,
                }),
            size: Joi.number()
                .max(5 * 1024 * 1024) // Max size: 5 MB
                .required()
                .messages({
                    'any.required': `${fileName} size must be provided`,
                    'number.max': `${fileName} must be less than 5MB`,
                }),
        }).unknown(true)
    )
    .min(1)
    .required()
    .messages({
        'any.required': `${fileName} is required`,
        'array.min': `At least one ${fileName} is required`,
    });

// Address details validation
const addressDetailsField = Joi.object({
    city_id: requiredNumber("City ID"),
    city_name: requiredString("City Name"),
    state_id: requiredNumber("State ID"),
    state_name: requiredString("State Name"),
    country_id: requiredNumber("Country ID"),
    country_name: requiredString("Country Name"),
    address: requiredString("Address"),
}).required().messages({
    'any.required': 'address_details is required',
});

// Identification validation
const identificationField = Joi.object({
    aadhaar_number: aadhaarNumberField(),
    // aadhaar_card_file: Joi.array()
    // .items(
    //     Joi.object({
    //         fieldname: Joi.string().valid('identification[aadhaar_card_file]').required()
    //             .messages({ "any.required": "Fieldname is required for Aadhaar card file" }),
    //         originalname: Joi.string().required()
    //             .messages({ "any.required": "Original file name is required for Aadhaar card" }),
    //         mimetype: Joi.string().valid("image/jpeg", "image/png").required()
    //             .messages({
    //                 "any.required": "File type is required for Aadhaar card",
    //                 "string.valid": "Aadhaar card file must be a JPEG or PNG image",
    //             }),
    //         size: Joi.number().max(5 * 1024 * 1024).required()
    //             .messages({
    //                 "any.required": "File size is required for Aadhaar card",
    //                 "number.max": "Aadhaar card file must be less than 5MB",
    //             }),
    //     }).unknown(true)
    // )
    // .min(1)
    // .required()
    // .messages({
    //     "any.required": "Aadhaar card file is required",
    //     "array.min": "At least one Aadhaar card file is required",
    // }),

    pan_number: panNumberField(),
    // pan_card_file: Joi.array()
    //     .items(
    //         Joi.object({
    //             fieldname: Joi.string().valid("identification[pan_card_file]").required(),
    //             originalname: Joi.string().required(),
    //             mimetype: Joi.string().valid("image/jpeg", "image/png").required(),
    //             size: Joi.number().max(5 * 1024 * 1024).required(),
    //         }).unknown(true)
    //     )
    //     .required()
    //     .messages({
    //         "any.required": "PAN card file is required",
    //         "array.min": "At least one PAN card file is required",
    //     }),
});

// Updated updateProfileSchema
const updateProfileSchema = {
    params: Joi.object({
        email: emailField(),
    }),
    body: Joi.object({
        name: nameField(),
        mobile_number: mobileNumberField(),
        address_details: addressDetailsField,
        identification: identificationField,
    }),
    files: Joi.object({
        profile_image: profileImageValidation("profile_image", "Profile Image"),
    }).unknown(true),
};

module.exports = {
    registerSchema,

    getUserSchema,
    updateUserSchema,
    deleteUserSchema,
    updateProfileSchema
};