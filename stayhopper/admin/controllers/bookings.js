const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");
const paginate = require("express-paginate");
const moment = require("moment");

const Booking = require("../../db/models/bookings");
const UserBooking = require("../../db/models/userbookings");
const Property = require("../../db/models/properties");

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

  let bookings = await UserBooking.find(where).sort({_id:-1})
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
    filter_date,
    moment
  };
  //   return res.json(data);
  res.render("admin/bookings/list", data);
});

router.get("/details", async (req, res) => {
  booking_id = req.query.book_id;
  let booking_details = await UserBooking.findOne({ _id:booking_id}).sort({'date_checkin':-1})
    .populate("property")
    .populate({
      path: "room.room",
      populate: [{ path: "room_name" },{ path: "room_type" }]
    });
  if (booking_details) {
    let guestinfo = booking_details.guestinfo;
    let full_name =
      guestinfo.title + " " + guestinfo.first_name + " " + guestinfo.last_name;
    let contact_no = guestinfo.mobile;
    let mail = guestinfo.email;
    let ref_no = booking_details.book_id;
    let room_info = [];
    booking_details.room.forEach(rec => {
      room_info.push({
        name:rec.room.custom_name||rec.room.room_name.name,
        type:rec.room.room_type.name,
        nos:rec.number
      });
    });
    let tmp_time = booking_details.checkin_date+" "+booking_details.checkin_time+":00";
    let checkout = new Date(tmp_time);
    let checkin_date = checkout.toDateString();
    let checkin_time = checkout.toLocaleTimeString();
    let no_of_childrens = booking_details.no_of_children;
    let no_of_adults = booking_details.no_of_adults;

    checkout.setHours( checkout.getHours()+booking_details.selected_hours);   
    let checkout_date = checkout.toDateString();
    let checkout_time = checkout.toLocaleTimeString();
    let property_name = "";
    if(booking_details.property){
      property_name = booking_details.property.name;
    } 
    let total_amt = booking_details.total_amt;
    let selected_hours = booking_details.selected_hours;
    console.log(booking_details);
    let booked_date = booking_details.date_booked.toDateString();
    let data = {
      full_name,
      contact_no,
      mail,
      ref_no,
      checkin_date,
      checkin_time,
      checkout_date,
      checkout_time,
      property_name,
      total_amt,
      selected_hours,
      booked_date,
      no_of_childrens,
      no_of_adults,
      room_info
    }
    return res.json({ status: 1, data: data });
  } else {
    return res.json({ status: 0, message: "No data" });
  }
});
module.exports = router;
