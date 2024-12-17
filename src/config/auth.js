const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class Auth {
    constructor() {
        this.secret = process.env.JWT_SECRET || 'your_jwt_secret';
        this.expiration = '1d'; // Token expiration time
    }

    generateToken(user) {
        return jwt.sign( user , this.secret, { expiresIn: this.expiration });
    }

    async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    }

    async comparePasswords(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = new Auth();