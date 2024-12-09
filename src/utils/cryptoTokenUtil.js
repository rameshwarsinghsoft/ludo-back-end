const crypto = require('crypto');

function cryptoTokenGenerator(length = 32) {
    // Generate random bytes and convert them to a hexadecimal string
    return crypto.randomBytes(length).toString('hex');
}

module.exports = cryptoTokenGenerator;