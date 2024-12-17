const Joi = require('joi');

const requiredMessage = (fieldName) => `${fieldName} is required`;

// string
// =========================================================================================================================================================
const stringMessages = (fieldName) => ({
    'string.base': `${fieldName} must be a text value`,
    'string.empty': `${fieldName} cannot be empty`,
});
const requiredString = (fieldName) => Joi.string().required().messages({
    ...stringMessages(fieldName),
    'any.required': requiredMessage(fieldName),
});

// number
// =========================================================================================================================================================
const numberMessages = (fieldName) => ({
    'number.base': `${fieldName} must be a number`,
    'number.empty': `${fieldName} cannot be empty`,
});
const requiredNumber = (fieldName) => Joi.number().required().messages({
    ...numberMessages(fieldName),
    'any.required': requiredMessage(fieldName),
});

const nameField = () => Joi.string().min(3).max(30).required().messages({
    ...stringMessages('Name'),
    'string.min': 'Name must be at least 3 characters long',
    'string.max': 'Name must not exceed 30 characters',
    'any.required': requiredMessage("Name"),
});

// const emailField = () => Joi.string().email().required().messages({
const emailField = () => Joi.string().pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{1,}$/).required().messages({
    'string.base': 'Email must be a text value',
    'string.empty': 'Email cannot be empty',
    'string.email': 'Please enter a valid email',
    'any.required': requiredMessage("Email"),
});

const emailFieldOptional = () => Joi.string()
    .email()
    .optional()
    .messages({
        'string.base': 'Email must be a text value',
        'string.empty': 'Email cannot be empty',
        'string.email': 'Please enter a valid email',
    });


const mobileNumberField = () => Joi.string()
    .pattern(/^(\+?\d{1,4})?[\s\-\(\)]?(\d{3})[\s\-\(\)]?(\d{3})[\s\-\(\)]?(\d{4})$/)
    .required()
    .messages({
        'any.required': requiredMessage("Mobile Number"),
        ...stringMessages("Mobile Number"),
        'string.pattern.base': `Mobile Number must be a valid phone number`,
    });

const aadhaarNumberField = () => Joi.string()
    .pattern(/^\d{12}$/)  // Ensures exactly 12 digits
    .required()
    .messages({
        'any.required': requiredMessage("Aadhaar Number"),
        ...stringMessages("Aadhaar Number"),
        'string.pattern.base': `Aadhaar Number must be a valid 12-digit number`,
    });

// PAN number validation field
const panNumberField = () => Joi.string()
    .pattern(/^[A-Z]{5}\d{4}[A-Z]{1}$/)
    .required()
    .messages({
        'any.required': requiredMessage("PAN Number"),
        ...stringMessages("PAN Number"),
        'string.pattern.base': `PAN Number must be a valid PAN (e.g. ABCDE1234F)`,
    });

const passwordField = (fieldName) => Joi.string()
    .min(7)
    .max(20)
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{7,}$"))
    .required()
    .messages({
        ...stringMessages(fieldName),
        'any.required': requiredMessage(fieldName),
        'string.min': `${fieldName} must be 7-20 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character`,
        'string.max': `${fieldName} length must not exceed 20 characters`,
        'string.pattern.base': `${fieldName} must be 7-20 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character`,
    });

const confirmPasswordField = (fieldName, referenceField) => Joi.string()
    .valid(Joi.ref(referenceField))  // Dynamically use the reference (password or new_password)
    .required()
    .messages({
        'any.only': `${fieldName} must match the ${referenceField}`,
        'any.required': `${fieldName} is required.`,
    });

// Image File Validation
const imageField1 = () => Joi.object({
    file: Joi.object({
        mimetype: Joi.string().valid('image/jpeg', 'image/png').required().messages({
            'any.required': 'Profile Image must be an image (JPEG or PNG)',
            'string.valid': 'Profile Image must be a JPEG or PNG image',
        }),
        size: Joi.number().max(5 * 1024 * 1024).required().messages({
            'any.required': 'Profile Image size must be provided',
            'number.max': 'Profile Image must be less than 5MB',
        }),
    }).required().messages({
        'any.required': 'Profile Image is required',
    }),
});

const imageField = () =>
    Joi.array()
        .items(
            Joi.object({
                // mimetype: Joi.string()
                //     .valid('image/jpeg', 'image/png')
                //     .required()
                //     .messages({
                //         'any.required': 'Image must be a JPEG or PNG file',
                //         'string.valid': 'Image must be a JPEG or PNG file',
                //     }),
                size: Joi.number()
                    .max(5 * 1024 * 1024)
                    .required()
                    .messages({
                        'any.required': 'Image size must be provided',
                        'number.max': 'Image must be less than 5MB',
                    }),
            })
        )
        .min(1)
        .required()
        .messages({
            'any.required': 'Image is required',
            'array.min': 'Image is required',
        });


module.exports = {
    requiredNumber,
    requiredString,
    nameField,
    emailFieldOptional,
    emailField,
    mobileNumberField,
    passwordField,
    confirmPasswordField,
    aadhaarNumberField,
    panNumberField,
    imageField
};