const express = require("express");
const app = new express.Router();

const speedcheckController = require('../controllers/test/speedcheck');

app.use('/speedcheck', speedcheckController);

module.exports = app;