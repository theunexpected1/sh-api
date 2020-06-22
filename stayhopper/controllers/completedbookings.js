const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");
const paginate = require("express-paginate");
const moment = require("moment");

const CompletedBooking = require("../db/models/completedbookings");
const Property = require("../db/models/properties");

router.get("/", paginate.middleware(10, 50), async (req, res) => {
  let session = req.session;
  
  let active_page = 1;
  if(req.query.page){
    active_page = req.query.page;
  }
  let filter_property = req.query.filter_property;
  let filter_date = req.query.filter_date;

  // let bookings = await CompletedBooking.find(where)
  //   .limit(req.query.limit)
  //   .skip(req.skip)
  //   .sort({ date_checkin: -1 });
  let filter = [
    {
      $lookup:{
        from:'properties',
        localField:'propertyInfo.id',
        foreignField:'_id',
        as:'property' 
      }
    },
    {$match:{'property.company':db.Types.ObjectId(session._id)}},
  ];

  if (filter_property) {
    filter.push(
      {
        $match:{
          'propertyInfo.id':db.Types.ObjectId(filter_property)
        }
      }
    );
  }
  if (filter_date) {
    filter.push(
      {
        $match:{
          'checkin_date': moment(new Date(filter_date)).format("YYYY-MM-DD")
        }
      }
    );
  }

  let count_filter = filter.slice();
  count_filter.push(
    {
      $count: "total"
    }
  );

  let itemCount = 0
  let itemCountRes = await CompletedBooking.aggregate(count_filter);
  if(itemCountRes[0]){
    itemCount = itemCountRes[0].total;
  }

  filter.push(
    { $sort :{ date_checkin : -1}},
    { $skip : req.skip },
    { $limit : req.query.limit}
  );

  let bookings  = await CompletedBooking.aggregate(filter);

  const pageCount = Math.ceil(itemCount / req.query.limit);
  let properties = await Property.find({company:db.Types.ObjectId(session._id)});
  let data = {
    bookings,
    properties,
    filter_property,
    filter_date,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    active_page
  };
  res.render("bookings/list_completed", data);
});

router.get("/details", async (req, res) => {
  booking_id = req.query.book_id;
  let booking_details = await CompletedBooking.findOne({_id:booking_id});
  // return res.json(booking_details);
  if (booking_details) {
    let guestinfo = booking_details.guestInfo;
    let full_name =
      guestinfo.title + " " + guestinfo.first_name + " " + guestinfo.last_name;
    let contact_no = guestinfo.mobile;
    let mail = guestinfo.email;
    let ref_no = booking_details.book_id;
    let room_info = [];
    booking_details.roomsInfo.forEach(rec => {
      room_info.push({
        name:rec.name,
        type:rec.type,
        nos:rec.number
      });
    });
    let checkin_date = booking_details.date_checkin.toDateString();
    let checkin_time = booking_details.date_checkin.toLocaleTimeString();

    let checkout = booking_details.date_checkout;
    let checkout_date = checkout.toDateString();
    let checkout_time = checkout.toLocaleTimeString();
    let property_name = booking_details.propertyInfo.name;
    let total_amt = booking_details.total_amt;
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
      room_info
    };
    return res.json({ status: 1, data: data });
  } else {
    return res.json({ status: 0, message: "No data" });
  }
});
module.exports = router;
