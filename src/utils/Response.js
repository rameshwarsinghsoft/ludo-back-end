class Response {

    static ApiResponse(res, statusCode, message, data, token) {
        return res.status(statusCode).json(
            {
                success: (statusCode === 200 || statusCode === 201),
                message,
                data,
                token
            }
        )
    }

    static ServiceResponse(success, status, message, data, token) {
        return { success, status, message, data, token }
    }

    static CatchError(error) {
        throw new Error(error || 'An error occurred');
    }
}

module.exports = {
    ApiResponse: Response.ApiResponse,
    ServiceResponse: Response.ServiceResponse,
    CatchError: Response.CatchError,
}