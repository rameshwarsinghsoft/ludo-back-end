const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const optSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    otp: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600
    }
});

const OTP = mongoose.model('opt', optSchema);

module.exports = OTP;
