const express = require("express");
const app = new express.Router();

const requireLogin = require("../../middleware/requiresLogin2");

const loginController = require("../controllers/login");
const propertiesController = require("../controllers/properties");
const roomsController = require("../controllers/rooms");
const pricingController = require("../controllers/pricing");
const policyController = require("../controllers/policy");
const photoController = require("../controllers/photos");
const availabilityController = require("../controllers/availability");
const hotemadminController = require("../controllers/hoteladmins");
const usersController = require("../controllers/users");
const paymentController = require("../controllers/payments");
const generalController = require("../controllers/generalsettings");
const propertyTypesController = require("../controllers/propertytypes");
const propertyRatingsController = require("../controllers/propertyratings");
const roomNamesController = require("../controllers/roomnames");
const roomTypesController = require("../controllers/roomtypes");
const bedTypesController = require("../controllers/bedtypes");
const noGuestsController = require("../controllers/no_guests");
const noBedsController = require("../controllers/no_beds");
const countriesController = require("../controllers/countries");
const citiesController = require("../controllers/cities");
const serviceController = require("../controllers/services");
const policiesController = require("../controllers/policies");
const termsController = require("../controllers/terms");
const currencyController = require("../controllers/currencies");
const taxController = require("../controllers/taxes");
const bookingController = require("../controllers/bookings.js");
const checkinoutController = require("../controllers/checkinout");
const nearbyController = require("../controllers/nearby");
const completedBookingsController = require("../controllers/completedbookings");
const termsAndConditionsController = require('../controllers/terms_conditions');
const faqController = require('../controllers/faq');
const notificationController = require('../controllers/notifications')
const resetpasswordController = require('../controllers/resetpassword');
const dashboardController = require('../controllers/dashboard');
const promoCodeController = require('../controllers/promocode');
const cancelBookingController = require('../controllers/cancelbookings');
const userReviewsController = require('../controllers/userreviews');

app.get("/", (req, res) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  if(req.session._id){
    return res.redirect('/admin/dashboard');
  }
  res.render("admin/login");
});
app.get("/logout", (req, res) => {
  req.session.destroy();
  return res.redirect("/admin/dashboard");
});
app.use("/login", loginController);
app.get("/redirect", requireLogin, (req, res) => {
  res.render("/admin/login");
});
// app.use("/dashboard", requireLogin, dashboardController);

app.get("/dashboard", requireLogin, (req, res)=>{
  return res.redirect("/admin/bookings");
});

app.use("/properties", requireLogin, propertiesController);
app.use("/rooms", requireLogin, roomsController);
app.use("/pricing", requireLogin, pricingController);
app.use("/policies", requireLogin, policyController);
app.use("/nearby", requireLogin, nearbyController);
app.use("/photos", requireLogin, photoController);
app.use("/availability", requireLogin, availabilityController);
app.use("/hoteladmins", requireLogin, hotemadminController);
app.use("/users", requireLogin, usersController);
app.use("/payments", requireLogin, paymentController);
app.use("/generalsettings", requireLogin, generalController);
app.use("/propertytypes", requireLogin, propertyTypesController);
app.use("/propertyratings", requireLogin, propertyRatingsController);
app.use("/roomnames", requireLogin, roomNamesController);
app.use("/roomtypes", requireLogin, roomTypesController);
app.use("/bedtypes", requireLogin, bedTypesController);
app.use("/no_guests", requireLogin, noGuestsController);
app.use("/no_beds", requireLogin, noBedsController);
app.use("/countries", requireLogin, countriesController);
app.use("/cities", requireLogin, citiesController);
app.use("/services", requireLogin, serviceController);
app.use("/policylist", requireLogin, policiesController);
app.use("/terms", requireLogin, termsController);
app.use("/currencies", requireLogin, currencyController);
app.use("/taxes", requireLogin, taxController);
app.use("/bookings", requireLogin, bookingController);
app.use("/checkinout", requireLogin, checkinoutController);
app.use("/completedbookings", requireLogin, completedBookingsController);
app.use('/terms_conditions', requireLogin, termsAndConditionsController);
app.use('/faq', requireLogin, faqController);
app.use('/resetpassword', requireLogin, resetpasswordController);
app.use('/notifications', requireLogin, notificationController);
app.use('/promocodes', requireLogin, promoCodeController);
app.use('/cancelbookings', requireLogin, cancelBookingController);
app.use('/userreviews', requireLogin, userReviewsController);

/** Sh 2.0 */
const authControllerV2 = require('../controllers/v2/auth');
const administratorsControllerV2 = require('../controllers/v2/administrators');
const usersControllerV2 = require('../controllers/v2/users');
const propertiesControllerV2 = require("../controllers/v2/properties");
const lookupsControllerV2 = require('../controllers/v2/lookups');

app.use("/v2/auth", authControllerV2);
app.use("/v2/properties", (req, res, next) => next(), propertiesControllerV2);
app.use("/v2/administrators", (req, res, next) => next(), administratorsControllerV2);
app.use("/v2/users", (req, res, next) => next(), usersControllerV2);
app.use("/v2/lookups", (req, res, next) => next(), lookupsControllerV2);

module.exports = app;
