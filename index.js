const express = require('express');
const readEmails = require('./src/processes/readMail');
const {checkTokensAndPerformAction} = require('./src/processes/process')
const authRoutes = require('./src/routes/auth');
const cors = require('cors')
const app = express();
const mongoose = require('mongoose');
const schedule = require('node-schedule');
const logger = require('./src/helpers/logger')
require('dotenv').config()
var corsOptions = {
    origin: '*',
};

app.use(express.json());
app.use(cors(corsOptions));

// Use auth routes
app.use(authRoutes);
app.use(require('./src/routes/readMail'));


mongoose
    .connect(process.env.MONGO_URL, {
        dbName: process.env.DBNAME,
    })
    .then(() => {
        logger.info("Connected to the database") 
    })
    .catch((error) => {
        logger.info(`Connected to the database ${error.message}`)
    });



schedule.scheduleJob('*/60 * * * * *', checkTokensAndPerformAction);

// checkTokensAndPerformAction()
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});
