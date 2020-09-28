const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const _ = require("underscore");
const momenttz = require("moment-timezone");
const moment = require("moment");
var ObjectId = require("mongodb").ObjectID;
const db = require("mongoose");

const config = require("config");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const fs = require("fs");

const Price = require("../../db/models/pricing");
const Booking = require("../../db/models/bookings");
const UserBooking = require("../../db/models/userbookings");
const CompletedBooking = require("../../db/models/completedbookings");
const Slot = require("../../db/models/slots");
const Room = require("../../db/models/rooms");
const BookLog = require("../../db/models/bookinglogs");
const Property = require("../../db/models/properties");
const PromoCode = require("../../db/models/promocodes");
const User = require("../../db/models/users");
const curl = new (require("curl-request"))();

let telr = require("telr-payment-nodejs")(
  config.telr_api,
  config.telr_store_id,
  {
    currency: "AED"
  }
);

router.get("/pay", async (req, res) => {
  let ts = Math.round(new Date().getTime() / 1000);
  curl
    .setBody({
      ivp_method: "create",
      ivp_store: "21005",
      ivp_authkey: "T9Pq^FFt4z~rKjB7",
      ivp_cart: ts,
      ivp_test: "0",
      ivp_amount: "1",
      ivp_currency: "AED",
      ivp_desc: "Stayhopper Booking",
      bill_fname: "Nishad",
      bill_sname: "Aliyar",
      bill_addr1: "Business Bay",
      bill_city: "Dubai",
      bill_country: "AE",
      bill_email: "nishadaliar@gmail.com",
      return_auth: config.app_url + "api/paymenttest/success",
      return_can:config.app_url+"api/paymenttest/failed",
      return_decl: config.app_url+"api/paymenttest/failed"
    })
    .post("https://secure.telr.com/gateway/order.json")
    .then(async ({ statusCode, body, headers }) => {
      let obj = JSON.parse(body);
      if (typeof obj.order != "undefined") {
        return_url = obj.order.url;
        ref = obj.order.ref;
        res.redirect(return_url); 
        // res.json({status:true,link:return_url,ref});
      } else {
        return res.json({status:false,message:"Payment Link Not Generated"});
      }
    })
    .catch(async e => {
      return res.json({status:false,message:"Payment Link Not Generated"});
    });
});

router.get("/success", async (req, res) => {
    return res.json({status:true});
});
router.get("/cancelled", async (req, res) => {
    return res.json({status:false});
});
router.get("/error", async (req, res) => {
    return res.json({status:false});
});


module.exports = router;
