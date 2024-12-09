const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const commonRoutes = require('./common.routes');

const apiRouter = (app) => {
    app.use('/api/user', userRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/common',commonRoutes)
};

module.exports = apiRouter;