const express = require("express");
const app = new express.Router();

// const propertiesController = require('../controllers/api/properties');
// const usersController = require('../controllers/api/users');
// const bookingController = require('../controllers/api/booking');
// const paymentController = require('../controllers/api/payment');
const ratingController = require('../controllers/api/rating');
const favouritesController = require('../controllers/api/favourites');
const generalController = require('../controllers/api/general');
const termsAndConditionsController = require('../controllers/api/termsAndConditions');
const faqController = require('../controllers/api/faq');
const notificationsController = require('../controllers/api/notifications');
const testController = require('../controllers/api/test');
const userRatingsController = require('../controllers/api/userratings');
const websiteController = require('../controllers/api/website');
const contactUsController = require('../controllers/api/contactus');
const paymentTestController = require('../controllers/api/testpayment');


// app.use("/properties", propertiesController);
// app.use("/users", usersController);
// app.use("/bookings", bookingController);
// app.use('/payment', paymentController);
app.use("/ratings", ratingController);
app.use("/favourites", favouritesController);
app.use("/general", generalController);
app.use('/termsAndConditions', termsAndConditionsController);
app.use('/faq', faqController);
app.use('/notifications', notificationsController);
app.use('/test', testController);
app.use('/userratings', userRatingsController);
app.use('/website', websiteController);
app.use('/contactus', contactUsController);
app.use('/paymenttest', paymentTestController);

// V2 
const usersControllerV2 = require('../controllers/api/v2/users');
const mainControllerV2 = require('../controllers/api/v2/main');
const propertiesControllerV2 = require('../controllers/api/v2/properties');
const bookingsControllerV2 = require('../controllers/api/v2/bookings');
const paymentControllerV2 = require('../controllers/api/v2/payment');
app.use("/users", usersControllerV2);
app.use("/main", mainControllerV2);
app.use("/properties", propertiesControllerV2);
app.use("/bookings", bookingsControllerV2);
app.use("/payment", paymentControllerV2);

module.exports = app;