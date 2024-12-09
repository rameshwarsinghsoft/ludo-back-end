const nodemailer = require('nodemailer');

class NodemailerConfig {
    static createTransporter() {
        return nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.SENDER_EMAIL,
                pass: process.env.SENDER_PASSWORD,
            },
        });
    }
}

module.exports = NodemailerConfig;