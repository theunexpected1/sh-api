const express = require("express");
const router = express.Router();
const moment = require("moment");
const http = require("http");
const db = require("mongoose");
const UserBooking = require('../../db/models/userbookings');
const Booking = require('../../db/models/bookings');
const BookLog = require('../../db/models/bookinglogs');
const User = require('../../db/models/users');
const Room = require('../../db/models/rooms');

const config = require("config");
const sgMail = require("@sendgrid/mail");
const fs = require('fs');


sgMail.setApiKey(config.sendgrid_api);

router.get('/success', async (req, res) => {
    let booking_id = req.query.booking_id;
    UB = await UserBooking.findOne({
        _id:booking_id
    });
    if(!UB){
        return res.json({'status':0});
    }
    UB.paid = 1;
    let status = 0;
    try{
        UB.save();
        status = 1;
         //send mail
         let html_body = fs.readFileSync("public/order_complete.html", "utf8");
         ub = await UserBooking.findOne({
           _id: db.Types.ObjectId(UB._id)
         }).populate("property")
           .populate("room.room");

         property = ub.property;
         
         let VATS = "";
         if(typeof property.payment != "undefined"){
             let payment = property.payment;
             if(typeof payment.excluding_vat !="undefined"){
                VATS += `Excluding VAT(`+payment.excluding_vat+`%),`;
             }
             if(typeof payment.tourism_fee !="undefined"){
                VATS += `Tourism Fee(`+payment.tourism_fee+`),`;
             }
             if(typeof payment.muncipality_fee !="undefined"){
                VATS += `Municipality Fee(`+payment.muncipality_fee+`),`;
             }
             if(typeof payment.service_charge !="undefined"){
                VATS += `Service Charge(`+payment.service_charge+`),`;
             }
         }
         VATS = VATS.slice(0, -1);
         VATS = "- "+VATS+" *";

         let HEADING_PROPERTY_NAME = property.name;
         let ORDER_NO = ub.book_id;
         let CHECKIN_DATE = moment(ub.date_checkin).format(
           "dddd DD-MM-YYYY | hh:mm A"
         );
         let PAYMENT_DATE = moment(ub.date_booked).format(
            "dddd DD-MM-YYYY | hh:mm A"
          );
         let NAME = ub.guestinfo.first_name;
         let PROPERTY_NAME = property.name;
         let NO_OF_GUESTS = "";
         let rooms = ub.room;
         let total_rooms = 0;
         for(var i=0;i<rooms.length;i++){
            total_rooms += rooms[i].number;
         }
         NO_OF_GUESTS += total_rooms + " room, ";
         if (ub.no_of_adults) NO_OF_GUESTS += ub.no_of_adults + " adults ";
         if (ub.no_of_children) NO_OF_GUESTS += ub.no_of_children + " child";
         let NO_OF_HOURS = ub.selected_hours+" hours";
         let TYPE_OF_ROOM = "";
         for (var i = 0; i < rooms.length; i++) {
           room = await Room.findOne({ _id: rooms[i].room }).populate(
             "room_type"
           );
           TYPE_OF_ROOM += room.room_type.name + ", ";
         }
         TYPE_OF_ROOM = TYPE_OF_ROOM.slice(0, TYPE_OF_ROOM.length-1);

         let TRANSACTION_REFERENCE = ub.ref||"";
         TRANSACTION_REFERENCE = TRANSACTION_REFERENCE.substring(0, 10);
         let BOOKING_CHARGE = config.booking_charge;
         if(ub.discount){
          BOOKING_CHARGE = config.booking_charge * (+ub.discount / 100);
          BOOKING_CHARGE = +config.booking_charge - +BOOKING_CHARGE.toFixed(2);
         } 
         let TOTAL_PRICE = +ub.total_amt + +BOOKING_CHARGE;
         let BALANCE_PRICE = ub.total_amt;
         let ADDRESS_LINE1 = "";
         if (property.contactinfo) {
           ADDRESS_LINE1 +=
             property.contactinfo.address_1 +
             " " +
             property.contactinfo.address_2;
         }
         let PHONE = property.contactinfo.mobile;
         let LATLNG = property.contactinfo.latlng.join(',');
         let DIRECTION_URL = "https://www.google.ae/maps/dir/"+LATLNG+"/"+LATLNG;
         html_body = html_body.replace('{{HEADING_PROPERTY_NAME}}',HEADING_PROPERTY_NAME);
         html_body = html_body.replace('{{ORDER_NO}}',ORDER_NO);
         html_body = html_body.replace('{{CHECKIN_DATE}}',CHECKIN_DATE);
         html_body = html_body.replace('{{CHECKIN_DATE}}',CHECKIN_DATE);
         html_body = html_body.replace('{{NAME}}',NAME);
         html_body = html_body.replace('{{PROPERTY_NAME}}',PROPERTY_NAME);
         html_body = html_body.replace('{{PROPERTY_NAME}}',PROPERTY_NAME);
         html_body = html_body.replace('{{NO_OF_GUESTS}}',NO_OF_GUESTS);
         html_body = html_body.replace('{{NO_OF_HOURS}}',NO_OF_HOURS);
         html_body = html_body.replace('{{TYPE_OF_ROOM}}',TYPE_OF_ROOM);
         html_body = html_body.replace('{{TOTAL_PRICE}}',"AED "+TOTAL_PRICE);
         html_body = html_body.replace('{{BOOKING_CHARGE}}',"AED "+BOOKING_CHARGE);
         html_body = html_body.replace('{{BALANCE_PRICE}}',"AED "+BALANCE_PRICE);
         html_body = html_body.replace('{{ADDRESS_LINE1}}',ADDRESS_LINE1);
         html_body = html_body.replace('{{PHONE}}',PHONE);
         html_body = html_body.replace('{{DIRECTION_URL}}',DIRECTION_URL);
         html_body = html_body.replace('{{TRANSACTION_REFERENCE}}',TRANSACTION_REFERENCE);
         html_body = html_body.replace('{{TRANSACTION_AMOUNT}}',BOOKING_CHARGE);
         html_body = html_body.replace('{{TRANSACTION_TIME}}',PAYMENT_DATE);
         html_body = html_body.replace('{{VATS}}',VATS);
         
         html_body = html_body.replace('{{PRINT_URL}}',config.app_url+'print/booking/'+UB._id);//config.app_url+"print/booking/"+UB._id       
         
         
         let msg = {
           to: ub.guestinfo.email,
           bcc: [{email:config.website_admin_bcc_email},{email:"b2cbookings@stayhopper.com"}],
           from: config.website_admin_from_email,
           fromname:config.fromname,
           subject: "Stayhopper:Booking success",
           text: "Stayhopper booking success",
           html: html_body
         };
         sgMail.send(msg);
              
         //send to hotel admin
         html_body = fs.readFileSync("public/order_complete_hotel.html", "utf8");

         html_body = html_body.replace('{{HEADING_PROPERTY_NAME}}',HEADING_PROPERTY_NAME);
         html_body = html_body.replace('{{ORDER_NO}}',ORDER_NO);
         html_body = html_body.replace('{{CHECKIN_DATE}}',CHECKIN_DATE);
         html_body = html_body.replace('{{CHECKIN_DATE}}',CHECKIN_DATE);
         html_body = html_body.replace('{{NAME}}',NAME);
         html_body = html_body.replace('{{PROPERTY_NAME}}',PROPERTY_NAME);
         html_body = html_body.replace('{{PROPERTY_NAME}}',PROPERTY_NAME);
         html_body = html_body.replace('{{NO_OF_GUESTS}}',NO_OF_GUESTS);
         html_body = html_body.replace('{{NO_OF_HOURS}}',NO_OF_HOURS);
         html_body = html_body.replace('{{TYPE_OF_ROOM}}',TYPE_OF_ROOM);
         html_body = html_body.replace('{{TOTAL_PRICE}}',"AED "+TOTAL_PRICE);
         html_body = html_body.replace('{{BOOKING_CHARGE}}',"AED "+BOOKING_CHARGE);
         html_body = html_body.replace('{{BALANCE_PRICE}}',"AED "+BALANCE_PRICE);
         html_body = html_body.replace('{{ADDRESS_LINE1}}',ADDRESS_LINE1);
         html_body = html_body.replace('{{PHONE}}',PHONE);
         html_body = html_body.replace('{{DIRECTION_URL}}',DIRECTION_URL);
         html_body = html_body.replace('{{TRANSACTION_REFERENCE}}',TRANSACTION_REFERENCE);
         html_body = html_body.replace('{{TRANSACTION_AMOUNT}}',BOOKING_CHARGE);
         html_body = html_body.replace('{{TRANSACTION_TIME}}',PAYMENT_DATE);
         html_body = html_body.replace('{{VATS}}',VATS);

         html_body = html_body.replace('{{GUESTNAME}}',ub.guestinfo.title+"."+ub.guestinfo.first_name+" "+ub.guestinfo.last_name);
         html_body = html_body.replace('{{GUEST_ADDRESS}}',ub.guestinfo.email);
         html_body = html_body.replace('{{GUEST_PHONE}}',ub.guestinfo.mobile);

         html_body = html_body.replace('{{PRINT_URL}}',config.app_url+'print/booking/'+UB._id);//config.app_url+"print/booking/"+UB._id

         msg = {
            to: property.contactinfo.email,
            bcc: [{email:config.website_admin_bcc_email},{email:"hotelbookings@stayhopper.com"}],
            from: config.website_admin_from_email,
            fromname:config.fromname,
            subject: "Stayhopper:New Booking",
            text: "Sconfigtayhopper New Hotel Booking",
            html: html_body
          };
          sgMail.send(msg);
    }catch(error){
        return res.json({error});
    }

    return res.json({'status':status});
});

router.get('/failed', async (req, res) => {
    let booking_id = req.query.booking_id;
    let promocode = req.query.promocode;
    UB = await UserBooking.findOne({
        _id:booking_id
    });
    let status = 0;
    try{
        if(promocode){
            await User.update({_id:UB.user},
                { $pull: 
                { promocodes:promocode }
            });
        }
        await Booking.update(
            {},
            { $pull: { slots: { userbooking: UB._id } } },
            { multi: true }
        );
        await BookLog.deleteMany({userbooking:UB._id});
        // await UB.remove();
        status = 1;
    }catch(error){
        console.log(error);
    }
    return res.json({'status':status});
});
module.exports = router;
