const db = require("./db/mongodb");
const express = require("express");
const router = express.Router();

const Property = require("./db/models/properties");
const Booking = require("./db/models/bookings");
const Slot = require("./db/models/slots");
const City = require("./db/models/cities");
const Price = require("./db/models/pricing");
const Room = require("./db/models/rooms");
const UserRating = require("./db/models/userratings");
const UserBooking = require("./db/models/userbookings");

const _ = require("underscore");
const moment = require("moment");
const geodist = require("geodist");

var fs = require("fs");
var pdf = require("html-pdf");
const config = require("config");

router.get("/booking/:id", async (req, res) => {
  ub = await UserBooking
    .findOne({
      _id: db.Types.ObjectId(req.params.id)
    })
    .populate("property")
    .populate("room.room")
  ;

  if (ub) {
    property = ub.property;
    let VATS = '';
    const taxesBreakdown = [];
    if (typeof property.charges !== "undefined" && property.charges.length) {
      property.charges.map(c => {
        const chargeName = c.name;
        const chargeValue = c.chargeType === 'percentage'
          ? `(${c.value}%)`
          : `(${ub.currencyCode} ${c.value})`
        taxesBreakdown.push(`${chargeName} ${chargeValue}`)
        return c;
      });
    }

    if (taxesBreakdown.length) {
      if (ub.bookingType === 'hourly') {
        VATS = `- Excluding ${taxesBreakdown.join(', ')} *`
      } else {
        VATS = `- ${taxesBreakdown.join(', ')} *`
      }
    }

    let HEADING_PROPERTY_NAME = property.name;
    let ORDER_NO = ub.book_id;
    let CHECKIN_DATE = moment(ub.date_checkin).format(
      "dddd DD-MM-YYYY | HH:mm"
    );
    let CHECKOUT_DATE = moment(ub.date_checkout).format(
      "dddd DD-MM-YYYY | hh:mm A"
    );
    let NAME = ub.guestinfo.first_name;
    let PROPERTY_NAME = property.name;
    // Capitalize first letter
    let BOOKING_TYPE = ub.bookingType
      ? ub.bookingType.charAt(0).toUpperCase() + ub.bookingType.substring(1)
      : ''
    ;
    let NO_OF_GUESTS = "";
    let rooms = ub.room;
    NO_OF_GUESTS += ub.room.length + " room(s) ";
    if (ub.no_of_adults) NO_OF_GUESTS += ub.no_of_adults + "adults ";
    if (ub.no_of_children) NO_OF_GUESTS += ub.no_of_children + "child";
    let STAY_DURATION = ub.stayDuration;
    let TYPE_OF_ROOM = "";
    for (var i = 0; i < rooms.length; i++) {
      room = await Room.findOne({ _id: rooms[i].room }).populate("room_type");
      TYPE_OF_ROOM += room.room_type.name + ", ";
    }
    const discountAmount = +ub.bookingFee * (ub.discount ? (parseInt(ub.discount) / 100) : 1);
    let TOTAL_PRICE = +ub.total_amt + (+ub.bookingFee - +discountAmount);
    let BALANCE_PRICE = +TOTAL_PRICE - +ub.paymentAmt;
    const TRANSACTION_AMOUNT = +ub.paymentAmt;
    const CURRENCY_CODE = ub.currencyCode;
    const BALANCE_PRICE_TRANSFORMED = BALANCE_PRICE
      ? `${CURRENCY_CODE} ${BALANCE_PRICE}`
      : VATS
        ? 'Taxes as below'
        : `${CURRENCY_CODE} 0`
    ;
    let ADDRESS_LINE1 = "";
    if (property.contactinfo) {
      ADDRESS_LINE1 = property.contactinfo.address_1 + " " + property.contactinfo.address_2;
    }
    let PHONE = property.contactinfo.mobile;
    let LATLNG = property.contactinfo.latlng.join(",");
    let DIRECTION_URL = `https://www.google.ae/maps/dir/${LATLNG}/${LATLNG}`;

    let html_body = fs.readFileSync("public/order_complete_pdf.html", "utf8");
    html_body = html_body.replace(/{{HEADING_PROPERTY_NAME}}/g, HEADING_PROPERTY_NAME);
    html_body = html_body.replace(/{{ORDER_NO}}/g, ORDER_NO);
    html_body = html_body.replace(/{{CHECKIN_DATE}}/g, CHECKIN_DATE);
    html_body = html_body.replace(/{{CHECKOUT_DATE}}/g, CHECKOUT_DATE);
    html_body = html_body.replace(/{{NAME}}/g, NAME);
    html_body = html_body.replace(/{{PROPERTY_NAME}}/g, PROPERTY_NAME);
    html_body = html_body.replace(/{{BOOKING_TYPE}}/g, BOOKING_TYPE);
    html_body = html_body.replace(/{{STAY_DURATION}}/g, STAY_DURATION);
    html_body = html_body.replace(/{{NO_OF_GUESTS}}/g, NO_OF_GUESTS);
    html_body = html_body.replace(/{{TYPE_OF_ROOM}}/g, TYPE_OF_ROOM);
    html_body = html_body.replace(/{{TOTAL_PRICE}}/g, `${CURRENCY_CODE} ${TOTAL_PRICE}`);
    html_body = html_body.replace(/{{BALANCE_PRICE}}/g, BALANCE_PRICE_TRANSFORMED);
    html_body = html_body.replace(/{{ADDRESS_LINE1}}/g, ADDRESS_LINE1);
    html_body = html_body.replace(/{{PHONE}}/g, PHONE);
    html_body = html_body.replace(/{{DIRECTION_URL}}/g, DIRECTION_URL);
    html_body = html_body.replace(/{{TRANSACTION_AMOUNT}}/g, `${CURRENCY_CODE} ${TRANSACTION_AMOUNT}`);
    html_body = html_body.replace(/{{VATS}}/g, VATS);

    try {
      res.setHeader('content-type', 'application/pdf');
      res.setHeader('Content-disposition', 'filename="'+ORDER_NO+'.pdf"');
      console.log('working on the buffer');

      return pdf.create(html_body).toBuffer(function(err, buffer) {
        console.log('err', err);
        if (err) {
          return res.status(500).send(err);
        }
        console.log('This is a buffer:', Buffer.isBuffer(buffer));
        return res.status(200).send(buffer);
      });
    } catch (e) {
      console.log('e', e);
      return res.status(500).send(e);
    }
  } else {
    return res.status(404).send("Booking not exists");
  }
});
module.exports = router;
