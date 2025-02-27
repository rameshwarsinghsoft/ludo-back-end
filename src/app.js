const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRouter = require('./routes');
const connectDB = require('./config/db');
const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

connectDB();
apiRouter(app);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

module.exports = app;