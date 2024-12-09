const mongoose = require('mongoose');
const { Schema } = mongoose;

// User Schema
const userSchema = new Schema({
    profile_image: { type: String, required: false },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    device_id: { type: String, required: true },
    type: { type: String, required: true },
    balance: { type: Number, required: false, default: 1000 },
    mobile_number: {
        type: String,
        required: false,
    },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;