const NodemailerConfig = require('../config/nodemailerConfig');
const { StatusCodes } = require('http-status-codes');

class MailService {

    static async sendForgotPasswordEmail(email, token) {
        try {
            const transporter = NodemailerConfig.createTransporter();
            const forgotPasswordLink = `${process.env.FRONT_END_URL}/auth/forgot-password/?email=${email}&token=${token}`;

            const mailOptions = {
                from: process.env.SENDER_EMAIL,
                to: email,
                subject: 'Forgot Password Request',
                html: `
                        <p>Dear <strong>${email}</strong>,</p>
                        <p>We received a request for a password reset. Click the link below to reset your password:</p>
                        <p><a href="${forgotPasswordLink}">Reset Your Password</a></p>
                        <p><strong>Important:</strong> This link will expire in 30 minutes. If you did not request a password reset, please disregard this email.</p>
                        <p>Thank you,<br>Village Management System</p>
                    `,
            };

            const sendMail = await transporter.sendMail(mailOptions);
            if (sendMail) {
                return {
                    success: true,
                    status: StatusCodes.OK,  // 200 OK
                    message: "Forgot password email sent successfully."
                };
            } else {
                return {
                    success: false,
                    status: StatusCodes.BAD_REQUEST,
                    message: "Failed to send forgot password email."
                };
            }
        } catch (error) {
            console.error('Error sending email:', error.message);
            return {
                success: false,
                status: StatusCodes.INTERNAL_SERVER_ERROR,
                message: `An error occurred while sending the email. ${error.message}`
            };
        }
    }

    static async createPasswordEmail(email, token) {
        try {
            const transporter = NodemailerConfig.createTransporter();

            // Construct the password creation link
            const createPasswordLink = `${process.env.FRONT_END_URL}/auth/create-password/?email=${email}&token=${token}`;

            const mailOptions = {
                from: process.env.SENDER_EMAIL,
                to: email,  // Send to the user's email
                subject: 'Create Your Password',
                html: `
                <p>Dear <strong>${email}</strong>,</p>
                <p>Thank you for registering with us. To complete your registration, please create your password by clicking the link below:</p>
                <p><a href="${createPasswordLink}">Create Your Password</a></p>
                <p><strong>Important:</strong> This link will expire in 30 minutes. If you did not request to create a password, please disregard this email.</p>
                <p>Thank you,<br>Village Management System</p>
            `,
            };

            // Send the email
            const sendMail = await transporter.sendMail(mailOptions);

            if (sendMail) {
                return {
                    success: true,
                    status: StatusCodes.OK,  // 200 OK
                    message: "Password creation email sent successfully."
                };
            } else {
                return {
                    success: false,
                    status: StatusCodes.BAD_REQUEST,
                    message: "Failed to send password creation email."
                };
            }
        } catch (error) {
            console.error('Error sending create password email:', error.message);
            return {
                success: false,
                status: StatusCodes.INTERNAL_SERVER_ERROR,
                message: `An error occurred while sending the email. ${error.message}`
            };
        }
    }
}

module.exports = MailService;