const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");
const paginate = require("express-paginate");
const moment = require("moment");

const Booking = require("../db/models/bookings");
const UserBooking = require("../db/models/userbookings");
const Property = require("../db/models/properties");

const config = require('config');
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const url = require('url');
const fs = require('fs');

router.get("/", paginate.middleware(10, 50), async (req, res) => {
  let session = req.session;

  let filter_property = req.query.filter_property;
  let filter_date = req.query.filter_date;
  if(filter_date){
    filter_date = moment(filter_date).format('YYYY-MM-DD');
  }

  let properties = await Property.find({company:db.Types.ObjectId(session._id)});
  let filter = [
    {
      $match:{
        paid:true
      }
    },
    {
      $lookup:{
        from:"properties",
        localField:"property",
        foreignField:"_id",
        as:"property"
      }
    },
    {
      $lookup:{
        from:"rooms",
        localField:"room.room",
        foreignField:"_id",
        as:"room_details"
      }
    },
    {
      $unwind:"$property"
    }]
   if(filter_property){
     filter.push({
       $match:{
         'property._id':db.Types.ObjectId(filter_property)
       }
     });
   } 
   if(filter_date){
     filter.push({
       $match:{
         'checkin_date':filter_date
       }
     });
   }
   filter.push(
    {
      $match:{
        'property.company':db.Types.ObjectId(session._id)
      }
    },
    {
      $unwind:'$room_details'
    },
    {
      $lookup:{
        from:"room_names",
        localField:"room_details.room_name",
        foreignField:"_id",
        as:"room_name"
      }
    },
    {
      $addFields:{
        room_name: { $arrayElemAt: ["$room_name.name", 0] }
      }
    },
    {
      $addFields:{
        custom_name: '$room_details.custom_name'
      }
    },
    {
      $addFields:{
        display_name:{$ifNull:['$room_name','$custom_name']} 
      }
    },
    {
      $group:{
        _id:{
          ub_id:'$_id'
        },
        guestinfo: { $addToSet: "$guestinfo" },
        cancel_request: { $addToSet: "$cancel_request" },
        trip_type: { $addToSet: "$trip_type" },
        room_names: { $push: "$display_name" },
        property_name: { $addToSet: "$property.name" },
        checkin_date: { $push: "$checkin_date" },
        checkin_time: { $push: "$checkin_time" },
        selected_hours: { $push: "$selected_hours" },
        cancel_approval: { $addToSet: "$cancel_approval" },
        book_id: { $addToSet: "$book_id" },
        date_checkin : {$addToSet: "$date_checkin"},
        date_checkout : {$addToSet: "$date_checkout"},
        checkout_time : {$addToSet: "$checkout_time"},
        date_booked : {$addToSet: "$date_booked"}
      }
    },
    {
      $project:
       {
          ub_id:'$_id.ub_id',
          guestinfo: { $arrayElemAt: [ "$guestinfo", 0 ] },
          cancel_request: { $arrayElemAt: [ "$cancel_request", 0 ] },
          cancel_approval: { $arrayElemAt: [ "$cancel_approval", 0 ] },
          trip_type: { $arrayElemAt: [ "$trip_type", 0 ] },
          room_names: "$room_names",
          property_name: { $arrayElemAt: [ "$property_name", 0 ] },
          checkin_date: { $arrayElemAt: [ "$checkin_date", 0 ] },
          checkin_time: { $arrayElemAt: [ "$checkin_time", 0 ] },
          selected_hours: { $arrayElemAt: [ "$selected_hours", 0 ] },
          book_id: { $arrayElemAt: ["$book_id",0] },
          date_checkin : {$arrayElemAt: ["$date_checkin",0]},
          date_checkout : {$arrayElemAt: ["$date_checkout",0]},
          checkout_time : {$arrayElemAt: ["$checkout_time",0]},
          date_booked : {$arrayElemAt: ["$date_booked",0]}
       }
    },
    {
      $sort:{
        // date_checkin:1,
        _id:-1
      }
    }
   );

  let bookings = await UserBooking.aggregate(filter);
  console.log(bookings);
  // return res.json({
  //   bookings
  // }) 
  // bookings = [];
  let itemCount = 0;
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
  res.render("bookings/list", data);
});

router.get("/details", async (req, res) => {
  booking_id = req.query.book_id;
  let booking_details = await UserBooking.findOne({ _id: booking_id }).sort({'date_checkin':-1})
    .populate("property")
    .populate({
      path: "room.room",
      populate: [{ path: "room_name" },{ path: "room_type" }]
    });
    // return res.json(booking_details);
  if (booking_details) {
    let guestinfo = booking_details.guestinfo;
    let full_name =
      guestinfo.title + " " + guestinfo.first_name + " " + guestinfo.last_name;
    let contact_no = guestinfo.mobile;
    let mail = guestinfo.email;
    let ref_no = booking_details.book_id;
    let room_info= [];
    booking_details.room.forEach(rec => {
      room_info.push({
        name:rec.room.custom_name||rec.room.room_name.name,
        type:rec.room.room_type.name,
        nos:rec.number
      })
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
    let property_name =  "";
    if(booking_details.property){
      property_name = booking_details.property.name;
    }
    let total_amt = booking_details.total_amt;
    let selected_hours = booking_details.selected_hours;
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
      no_of_adults,
      no_of_childrens,
      room_info
    }
    return res.json({ status: 1, data: data });
   } else {
    return res.json({ status: 0, message: "No data" });
  }
});

router.post('/cancelbooking',async(req,res)=>{
  let id = req.body.id;
  let userbooking = await UserBooking.findOne({_id:id}).populate('property').populate({path:'room.room',populate:{path:'room_type'}});
  let hotel_name = userbooking.property.name;
  let guest_name = userbooking.guestinfo.title+". "+userbooking.guestinfo.first_name+" "+userbooking.guestinfo.last_name;
  let book_id = userbooking.book_id;
  let date = userbooking.checkin_date+" "+userbooking.checkin_time;
  let user_mobile = userbooking.guestinfo.mobile;
  let booked_property = hotel_name;
  let booked_property_address = userbooking.property.contactinfo.location;
  let booked_property_email = userbooking.property.contactinfo.email;
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
  date = moment(date).format('dddd YYYY-MM-DD HH:mm');
  let booked_date = date;
  if(userbooking){
    userbooking.cancel_request = 1;
    await userbooking.save();
    let html_body = fs.readFileSync('public/order_cancel_request.html', 'utf8');
    
    html_body = html_body.replace('{{USERNAME}}',guest_name);
    html_body = html_body.replace('{{HOTEL_NAME}}',hotel_name);
    html_body = html_body.replace('{{BOOKID}}',book_id);
    html_body = html_body.replace('{{DATE}}',date);
    html_body = html_body.replace('{{USER_MOBILE}}',user_mobile);
    html_body = html_body.replace('{{BOOKED_PROPERTY}}',booked_property);
    html_body = html_body.replace('{{BOOKED_PROPERTY_ADDRESS}}',booked_property_address);
    html_body = html_body.replace('{{BOOKED_PROPERTY_PHONE}}',booked_property_phone);
    html_body = html_body.replace('{{SELECTED_HOURS}}',selected_hours);
    html_body = html_body.replace('{{BOOKED_ROOM_TYPES}}',booked_room_types);
    html_body = html_body.replace('{{BOOKED_DATE}}',booked_date);
    html_body = html_body.replace('{{HOTEL_CONTACT_NUMBER}}',booked_property_phone);
    html_body = html_body.replace('{{HOTEL_EMAIL}}',booked_property_email);
    
    msg = {
      to: config.website_cancellation_email,
      bcc: [{ email: config.website_admin_bcc_email}],
      from: {
        email: config.website_admin_from_email,
        name: config.fromname
      },
      subject: "STAYHOPPER: Booking cancellation request",
      text:
        "Booking cancellation request",
      html: html_body
    };

    sgMail.send(msg);

    return res.json({status:1,message:'Booking Cancellation Request send successfully!'})
  }else{
    return res.json({status:0,message:'Could not cancel booking'})
  }
});
module.exports = router;
