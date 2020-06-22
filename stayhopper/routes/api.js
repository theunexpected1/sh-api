const express = require("express");
const app = new express.Router();

const propertiesController = require('../controllers/api/properties');
const ratingController = require('../controllers/api/rating');
const usersController = require('../controllers/api/users');
const favouritesController = require('../controllers/api/favourites');
const bookingController = require('../controllers/api/booking');
const generalController = require('../controllers/api/general');
const termsAndConditionsController = require('../controllers/api/termsAndConditions');
const faqController = require('../controllers/api/faq');
const notificationsController = require('../controllers/api/notifications');
const testController = require('../controllers/api/test');
const userRatingsController = require('../controllers/api/userratings');
const websiteController = require('../controllers/api/website');
const contactUsController = require('../controllers/api/contactus');
const paymentController = require('../controllers/api/payment');
const paymentTestController = require('../controllers/api/testpayment');


app.use("/properties", propertiesController);
app.use("/ratings", ratingController);
app.use("/users", usersController);
app.use("/favourites", favouritesController);
app.use("/bookings", bookingController);
app.use("/general", generalController);
app.use('/termsAndConditions', termsAndConditionsController);
app.use('/faq', faqController);
app.use('/notifications', notificationsController);
app.use('/test', testController);
app.use('/userratings', userRatingsController);
app.use('/website', websiteController);
app.use('/contactus', contactUsController);
app.use('/payment', paymentController);
app.use('/paymenttest', paymentTestController);

module.exports = app;