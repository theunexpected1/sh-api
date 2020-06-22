const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const Country = require("../../db/models/countries");
const HotelAdmin = require("../../db/models/hoteladmins");
const Property = require("../../db/models/properties");
const CompletedBooking = require("../../db/models/completedbookings");
const UserBooking = require("../../db/models/userbookings");
const moment = require('moment');

router.get("/", async (req, res) => {
    let hoteladmins = await HotelAdmin.find();
    let date = moment().format('YYYY-MM-DD');
    //todays bookings
    let completedBookings = await CompletedBooking.find({date_checkin:{"$gte": new Date(date)}}).count();
    let activeBookings = await UserBooking.find({date_checkin:{"$gte": new Date(date)}}).count();
    let totalBookings = completedBookings + activeBookings;
    //all time bookings
    let completedBookings_all = await CompletedBooking.find().count();
    let activeBookings_all = await UserBooking.find().count();
    let totalBookings_all = completedBookings_all + activeBookings_all;

    let data = {
        hoteladmins,
        totalBookings,
        totalBookings_all
    }
    res.render("admin/dashboard",data);
});

router.get("/bookingscount/today",async(req,res)=>{
    id = req.query.id;
    let date = moment().format('YYYY-MM-DD');
    let properties = [];
    let completedBookings = 0;
    let activeBookings = 0;
    if(id){
        properties = await Property.find({company:id}).lean().exec();
        for(var i=0;i<properties.length;i++){
            completedBookings += await CompletedBooking.find({'propertyInfo.id':properties[i]._id,date_checkin:{"$gte": new Date(date)}}).count();
            activeBookings += await UserBooking.find({'property':properties[i]._id,date_checkin:{"$gte": new Date(date)}}).count();
        }
    }else{
        completedBookings += await CompletedBooking.find({date_checkin:{"$gte": new Date(date)}}).count();
        activeBookings += await UserBooking.find({date_checkin:{"$gte": new Date(date)}}).count();
    }
    return res.json({totalBookings:(completedBookings+activeBookings)});
});

router.get("/bookingscount/all",async(req,res)=>{
    id = req.query.id;
    let date = moment().format('YYYY-MM-DD');
    let properties = [];
    let completedBookings = 0;
    let activeBookings = 0;
    if(id){
        properties = await Property.find({company:id}).lean().exec();
        for(var i=0;i<properties.length;i++){
            completedBookings += await CompletedBooking.find({'propertyInfo.id':properties[i]._id}).count();
            activeBookings += await UserBooking.find({'property':properties[i]._id}).count();
        }
    }else{
        completedBookings += await CompletedBooking.find().count();
        activeBookings += await UserBooking.find().count();
    }
    return res.json({totalBookings:(completedBookings+activeBookings)});
});

module.exports = router;
  