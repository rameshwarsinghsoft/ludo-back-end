const express = require('express');
const { register, getAllUsers, updateUser, softDeleteUser, deleteUser, toggleUserActiveStatus } = require('../controllers/user.controller');
const { validate, AuthMiddleware } = require('../middlewares')
const { registerSchema, getUserSchema, updateUserSchema, deleteUserSchema } = require('../validations/user.validation')

const router = express.Router();

// Define routes
router.post('/register', validate(registerSchema), register);
router.get('/:email?', validate(getUserSchema), getAllUsers);
router.put('/update/:email', validate(updateUserSchema), updateUser);
router.patch('/soft-delete/:email', validate(deleteUserSchema), softDeleteUser);
router.delete('/delete/:email', validate(deleteUserSchema), deleteUser);
router.patch('/toggle-user-active/:email', validate(getUserSchema), toggleUserActiveStatus);

module.exports = router;