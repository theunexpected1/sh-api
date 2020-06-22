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
  ub = await UserBooking.findOne({
    _id: db.Types.ObjectId(req.params.id)
  })
    .populate("property")
    .populate("room.room");
  if (ub) {
    property = ub.property;
    let HEADING_PROPERTY_NAME = property.name;
    // let ORDER_NO = ub._id;
    let ORDER_NO = ub.book_id;
    let CHECKIN_DATE = moment(ub.date_checkin).format(
      "dddd DD-MM-YYYY | HH:mm"
    );
    let NAME = ub.guestinfo.first_name;
    let PROPERTY_NAME = property.name;
    let NO_OF_GUESTS = "";
    let rooms = ub.room;
    NO_OF_GUESTS += ub.room.length + " room(s) ";
    if (ub.no_of_adults) NO_OF_GUESTS += ub.no_of_adults + "adults ";
    if (ub.no_of_children) NO_OF_GUESTS += ub.no_of_children + "child";
    let NO_OF_HOURS = ub.selected_hours;
    let TYPE_OF_ROOM = "";
    for (var i = 0; i < rooms.length; i++) {
      room = await Room.findOne({ _id: rooms[i].room }).populate("room_type");
      TYPE_OF_ROOM += room.room_type.name + ", ";
    }
    let TOTAL_PRICE = ub.total_amt + config.booking_charge;
    let BOOKING_CHARGE = config.booking_charge;
    let BALANCE_PRICE = ub.total_amt;
    let ADDRESS_LINE1 = "";
    if (property.contactinfo) {
      ADDRESS_LINE1 +=
        property.contactinfo.address_1 + " " + property.contactinfo.address_2;
    }
    let PHONE = property.contactinfo.mobile;
    let LATLNG = property.contactinfo.latlng.join(",");
    let DIRECTION_URL =
      "https://www.google.ae/maps/dir/" + LATLNG + "/" + LATLNG;

    let html_body = fs.readFileSync("public/order_complete_pdf.html", "utf8");

    html_body = html_body.replace(
      "{{HEADING_PROPERTY_NAME}}",
      HEADING_PROPERTY_NAME
    );
    html_body = html_body.replace("{{ORDER_NO}}", ORDER_NO);
    html_body = html_body.replace("{{CHECKIN_DATE}}", CHECKIN_DATE);
    html_body = html_body.replace("{{CHECKIN_DATE}}", CHECKIN_DATE);
    html_body = html_body.replace("{{NAME}}", NAME);
    html_body = html_body.replace("{{PROPERTY_NAME}}", PROPERTY_NAME);
    html_body = html_body.replace("{{PROPERTY_NAME}}", PROPERTY_NAME);
    html_body = html_body.replace("{{NO_OF_GUESTS}}", NO_OF_GUESTS);
    html_body = html_body.replace("{{NO_OF_HOURS}}", NO_OF_HOURS);
    html_body = html_body.replace("{{TYPE_OF_ROOM}}", TYPE_OF_ROOM);
    html_body = html_body.replace("{{TOTAL_PRICE}}", "AED " + TOTAL_PRICE);
    html_body = html_body.replace(
      "{{BOOKING_CHARGE}}",
      "AED " + BOOKING_CHARGE
    );
    html_body = html_body.replace("{{BALANCE_PRICE}}", "AED " + BALANCE_PRICE);
    html_body = html_body.replace("{{ADDRESS_LINE1}}", ADDRESS_LINE1);
    html_body = html_body.replace("{{PHONE}}", PHONE);
    html_body = html_body.replace("{{DIRECTION_URL}}", DIRECTION_URL);
    //   pdf.create(html_body).toStream(function(err, stream){
    //     stream.pipe(fs.createWriteStream('public/foo.pdf'));
    //   });
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('Content-disposition', 'filename="'+ORDER_NO+'.pdf"');
    pdf.create(html_body).toBuffer(function(err, buffer) {
      // console.log('This is a buffer:', Buffer.isBuffer(buffer));
      return res.send(buffer);
    });
  } else {
    return res.send("Booking not exists");
  }
});
module.exports = router;
