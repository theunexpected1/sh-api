const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");
const paginate = require("express-paginate");
const moment = require("moment");

const config = require("config");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const url = require("url");
const fs = require('fs');

const HotelAdmin = require("../../db/models/hoteladmins");
const Booking = require("../../db/models/bookings");
const UserBooking = require("../../db/models/userbookings");
const BookLog = require("../../db/models/bookinglogs");
const Property = require("../../db/models/properties");
const User = require('../../db/models/users');

router.get("/", paginate.middleware(10, 50), async (req, res) => {
  let filter_property = req.query.filter_property;
  let filter_date = req.query.filter_date;

  let properties = await Property.find();
  where = {};
  if (filter_property) {
    where.property = filter_property;
  }
  if (filter_date) {
    where.checkin_date = moment(new Date(filter_date)).format("YYYY-MM-DD");
  }
  where.cancel_request = 1;
  where.cancel_approval = 0;

  let bookings = await UserBooking.find(where)
    .sort({ date_checkin: 1 })
    .populate("property")
    .populate({
      path: "room.room",
      populate: [{ path: "room_name" }]
    })
    .limit(req.query.limit)
    .skip(req.skip)
    .lean()
    .exec();
  let itemCount = await UserBooking.find(where).count({});
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    properties,
    bookings,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    search: req.query.search,
    filter_property,
    filter_date
  };
  //   return res.json(data);
  res.render("admin/cancelbooking/list", data);
});

router.post("/deletebooking", async (req, res) => {
  let id = req.body.id;
  let userbooking = await UserBooking.findOne({ _id: id })
    .populate("property")
    .populate({ path: "room.room", populate: { path: "room_type" } });
  let hotel_name = userbooking.property.name;
  let guest_name =
    userbooking.guestinfo.title +
    ". " +
    userbooking.guestinfo.first_name +
    " " +
    userbooking.guestinfo.last_name;  
  let book_id = userbooking.book_id;
  let date = userbooking.checkin_date + " " + userbooking.checkin_time;
  let booked_property_address = userbooking.property.contactinfo.location;
  let booked_property_phone = userbooking.property.contactinfo.mobile;
  let selected_hours = userbooking.selected_hours;
  let booked_room_types = "";
  let rooms = userbooking.room;
  let guest_email = userbooking.guestinfo.email;
  for (var i = 0; i < rooms.length; i++) {
    booked_room_types += rooms[i].room.room_type.name;
  }
  if (booked_room_types) {
    booked_room_types = booked_room_types.replace(/,\s*$/, "");
  }
  date = moment(date).format("dddd YYYY-MM-DD hh:mm A");

  if (userbooking) {
    hoteladmin = await HotelAdmin.findOne({ properties: userbooking.property });
    await Booking.update(
      {},
      { $pull: { slots: { userbooking: id } } },
      { multi: true }
    );
    await BookLog.deleteMany({ userbooking: id });
    userbooking.cancel_approval = 1;
   
    await userbooking.save();
    
    let html_body = fs.readFileSync('public/order_cancelled.html', 'utf8');
    
    html_body = html_body.replace('{{USER_NAME}}',guest_name);
    html_body = html_body.replace('{{HOTEL_NAME}}',hotel_name);
    html_body = html_body.replace('{{HOTEL_NAME}}',hotel_name);
    html_body = html_body.replace('{{HOTEL_NAME}}',hotel_name);
    html_body = html_body.replace('{{BOOK_ID}}',book_id);
    html_body = html_body.replace('{{DATE}}',date);
    html_body = html_body.replace('{{ADDRESS}}',booked_property_address);
    html_body = html_body.replace('{{HOTEL_PHONE}}',booked_property_phone);
    html_body = html_body.replace('{{SELECTED_HOURS}}',selected_hours);
    html_body = html_body.replace('{{ROOM_TYPE}}',booked_room_types);
    html_body = html_body.replace('{{DATE}}',date);

    msg = {
      to: guest_email,
      bcc: [{ email: config.website_admin_bcc_email}],//config.website_admin_bcc_email
      from: config.website_admin_from_email,
      fromname:config.fromname,
      subject: "STAYHOPPER: Booking cancellation request",
      text:
        "Booking cancellation request",
      html: html_body
    };

    sgMail.send(msg);

    return res.json({
      status: 1,
      message: "Booking deleted successfully!"
    });
  } else {
    return res.json({
      status: 0,
      message: "Booking cannot delete successfully!"
    });
  }
});

router.post("/rejectcancellation", async (req, res) => {
  let id = req.body.id;
  //fetch mail details
  let userbooking = await UserBooking.findOne({_id:id}).populate('property').populate({path:'room.room',populate:{path:'room_type'}});
  let hotel_name = userbooking.property.name;
  let guest_name = userbooking.guestinfo.title+". "+userbooking.guestinfo.first_name+" "+userbooking.guestinfo.last_name;
  let book_id = userbooking.book_id;
  let date = userbooking.checkin_date+" "+userbooking.checkin_time;
  let user_mobile = userbooking.guestinfo.mobile;
  let booked_property = hotel_name;
  let booked_property_address = userbooking.property.contactinfo.location;
  let booked_property_phone = userbooking.property.contactinfo.mobile;
  let selected_hours = userbooking.selected_hours;
  let booked_room_types = "";
  let rooms = userbooking.room;
  for(var i=0;i<rooms.length;i++){
    booked_room_types += rooms[i].room.room_type.name;
  }
  if(booked_room_types){
    booked_room_types = booked_room_types.replace(/,\s*$/, "");
  }
  date = moment(date).format('dddd YYYY-MM-DD hh:mm A');
  let booked_date = date;
  //end 

  if (userbooking) {
    hoteladmin = await HotelAdmin.findOne({ properties: userbooking.property._id });
    userbooking.cancel_approval = 2;
    await userbooking.save();

    let html_body = fs.readFileSync('public/order_cancel_request_rejected.html', 'utf8');
    
    html_body = html_body.replace('{{GUEST_NAME}}',guest_name);
    html_body = html_body.replace('{{HOTEL_NAME}}',hotel_name);
    html_body = html_body.replace('{{BOOK_ID}}',book_id);
    html_body = html_body.replace('{{DATE}}',date);
    html_body = html_body.replace('{{GUEST_PHONE}}',user_mobile);
    html_body = html_body.replace('{{PROPERTY_NAME}}',booked_property);
    html_body = html_body.replace('{{PROPERTY_ADDRESS}}',booked_property_address);
    html_body = html_body.replace('{{PROPERTY_PHONE}}',booked_property_phone);
    html_body = html_body.replace('{{SELECTED_HOURS}}',selected_hours);
    html_body = html_body.replace('{{PROPERTY_ROOMS}}',booked_room_types);
    html_body = html_body.replace('{{DATE}}',date);

    if (hoteladmin) {
      msg = {
        to: hoteladmin.email,
        bcc: [{ email: config.website_admin_bcc_email},{ email: "saleesh.pp@iroidtechnologies.com"}],
        from: config.website_admin_from_email,
        fromname:config.fromname,
        subject: "STAYHOPPER: booking cancellation request rejected!",
        text: "Your booking cancellation request has been rejected",
        html:html_body
      };
      sgMail.send(msg);
    }
  }

  return res.json({
    status: 1,
    message: "Cancellation request rejected by admin"
  });
});
module.exports = router;
