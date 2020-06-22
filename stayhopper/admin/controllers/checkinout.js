const express = require("express");
const router = express.Router();
const paginate = require("express-paginate");
const moment = require('moment');
const db = require('../../db/mongodb')

const Booking = require("../../db/models/bookings");
const UserBooking = require("../../db/models/userbookings");
const Property = require("../../db/models/properties");
const CompletedBooking = require("../../db/models/completedbookings");


router.get("/", paginate.middleware(10, 50), async (req, res) => {
  let session = req.session;
  let filter_property = req.query.filter_property;
  let filter_date = req.query.filter_date;
  if(filter_date){
    filter_date = moment(filter_date).format('YYYY-MM-DD');
  }else{
    filter_date = moment(new Date()).format('YYYY-MM-DD');
  }

  let properties = await Property.find({});
  let filter = [
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
        date_checkin: { $addToSet: "$date_checkin" },
        date_booked: { $addToSet: "$date_booked" },
        paid: { $addToSet: "$paid" }
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
          date_checkin: { $arrayElemAt: ["$date_checkin",0] },
          date_booked: { $arrayElemAt: ["$date_booked",0] },
          paid: { $arrayElemAt: ["$paid",0] }
       }
    },
    {
      $sort:{
        date_checkin:1,
        date_booked:1
      }
    }
   );
  let bookings = await UserBooking.aggregate(filter);
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
  res.render("admin/checkinout/list",data);
});

router.get("/completed", paginate.middleware(10, 50), async (req, res) => {
  let active_page = 1;
  if(req.query.page){
    active_page = req.query.page;
  }
  let filter_property = req.query.filter_property;
  let filter_date = new Date();

  let where = {};
  where.date_checkout = {
    $gte: new Date(moment(new Date()).format("YYYY-MM-DD"))
  };
  if (filter_property) {
    where["propertyInfo.id"] = filter_property;
  }

  let bookings = await CompletedBooking.find(where)
    .limit(req.query.limit)
    .skip(req.skip)
    .sort({ date_checkin: -1 });
  let itemCount = await CompletedBooking.find(where).count({});
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let properties = await Property.find();
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
  res.render("admin/checkinout/list_completed", data);
});

module.exports = router;
