const express = require('express');
const { updateProfile } = require('../controllers/common.controller');
const { validate, AuthMiddleware, upload } = require('../middlewares');
const { updateProfileSchema } = require('../validations/user.validation')
const router = express.Router();

let fields = [
    { name: 'profile_image' },
    { name: 'identification[aadhaar_card_file]' },
    { name: 'identification[pan_card_file]' }
];

router.put('/update-profile/:email',AuthMiddleware.verifyToken, upload.fields(fields), validate(updateProfileSchema), updateProfile);

module.exports = router;