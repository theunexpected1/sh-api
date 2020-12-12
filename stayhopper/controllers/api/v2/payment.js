const express = require("express");
const router = express.Router();
const moment = require("moment");
const http = require("http");
const db = require("mongoose");
const UserBooking = require('../../../db/models/userbookings');
const Booking = require('../../../db/models/bookings');
const BookLog = require('../../../db/models/bookinglogs');
const User = require('../../../db/models/users');
const Room = require('../../../db/models/rooms');

const config = require("config");
const sgMail = require("@sendgrid/mail");
const fs = require('fs');


sgMail.setApiKey(config.sendgrid_api);

router.get('/success', async (req, res) => {
    let booking_id = req.query.booking_id;
    let platform = req.query.platform || 'app'; // 'web' or 'app'
    let status = 0;
    try {
        UB = await UserBooking.findOne({
          _id: booking_id
        });
        if (!UB) {
          return res.json({'status':0});
        }
        UB.paid = 1;
        UB.cancel_request = 0;
        UB.save();
        status = 1;
         //send mail
         let html_body = fs.readFileSync("public/order_complete.html", "utf8");
         ub = await UserBooking.findOne({
           _id: db.Types.ObjectId(UB._id)
         }).populate("property")
           .populate("room.room");

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
           "dddd DD-MM-YYYY | hh:mm A"
         );
         let CHECKOUT_DATE = moment(ub.date_checkout).format(
          "dddd DD-MM-YYYY | hh:mm A"
        );
         let PAYMENT_DATE = moment(ub.date_booked).format(
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
         let total_rooms = 0;
         for(var i=0;i<rooms.length;i++) {
          total_rooms += rooms[i].number;
         }
         NO_OF_GUESTS += total_rooms + " room, ";
         if (ub.no_of_adults) NO_OF_GUESTS += ub.no_of_adults + " adults ";
         if (ub.no_of_children) NO_OF_GUESTS += ub.no_of_children + " child";
         let STAY_DURATION = ub.stayDuration;
         const typeOfRooms = [];
         let TYPE_OF_ROOM = '';
         for (var i = 0; i < rooms.length; i++) {
           room = await Room.findOne({ _id: rooms[i].room }).populate(
             "room_type"
           );
           typeOfRooms.push(room.room_type.name);
         }

         if (typeOfRooms.length) {
          TYPE_OF_ROOM = typeOfRooms.join(', ');
         }

         let TRANSACTION_REFERENCE = ub.ref||"";
         TRANSACTION_REFERENCE = TRANSACTION_REFERENCE.substring(0, 10);
        //  let TOTAL_PRICE = +ub.total_amt + +ub.bookingFee - +ub.discount;
         const discountAmount = +ub.bookingFee * (ub.discount ? (parseInt(ub.discount) / 100) : 1);
         let TOTAL_PRICE = +ub.total_amt + (+ub.bookingFee - +discountAmount);
         let BALANCE_PRICE = +TOTAL_PRICE - +ub.paymentAmt;
         const TRANSACTION_AMOUNT = +ub.paymentAmt;
        // UB.discount = data.discount
        //   ? parseInt(ub.bookingFee) * (parseInt(ub.discount) / 100)
        //   : data.discount
        // ;

         let ADDRESS_LINE1 = "";
         if (property.contactinfo) {
           ADDRESS_LINE1 = `${property.contactinfo.address_1} ${property.contactinfo.address_2}`;
         }

         let PHONE = property.contactinfo.mobile;
         let LATLNG = property.contactinfo.latlng.join(',');
         const CURRENCY_CODE = ub.currencyCode;
         const BALANCE_PRICE_TRANSFORMED = BALANCE_PRICE
           ? `${CURRENCY_CODE} ${BALANCE_PRICE}`
           : VATS
            ? 'Taxes as below'
            : `${CURRENCY_CODE} 0`
         ;

         let DIRECTION_URL = "https://www.google.ae/maps/dir/"+LATLNG+"/"+LATLNG;
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
         html_body = html_body.replace(/{{TRANSACTION_REFERENCE}}/g, TRANSACTION_REFERENCE);
         html_body = html_body.replace(/{{TRANSACTION_AMOUNT}}/g, `${CURRENCY_CODE} ${TRANSACTION_AMOUNT}`);
         html_body = html_body.replace(/{{TRANSACTION_TIME}}/g, PAYMENT_DATE);
         html_body = html_body.replace(/{{VATS}}/g, VATS);
         html_body = html_body.replace(/{{PRINT_URL}}/g, config.api_url+'print/booking/'+UB._id);
         //config.api_url+"print/booking/"+UB._id

         // TODO: Enable Emails for production
         let msg = {
            //  NEW
            to: ub.guestinfo.email,
            // bcc: [{email:config.website_admin_bcc_email},{email:"b2cbookings@stayhopper.com"}],
            // TESTING
            bcc: [
              { email:'rahul.vagadiya+shguest@gmail.com' },
              { email: config.website_admin_bcc_email }
            ],
            from: {
              email: config.website_admin_from_email,
              name: config.fromname
            },
            subject: "Stayhopper:Booking success",
            text: "Stayhopper booking success",
            html: html_body
         };
         sgMail.send(msg).catch(e => console.log('error in mailing the guest', e));
              
         //send to hotel admin
         html_body = fs.readFileSync("public/order_complete_hotel.html", "utf8");

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
         html_body = html_body.replace(/{{TRANSACTION_REFERENCE}}/g, TRANSACTION_REFERENCE);
         html_body = html_body.replace(/{{TRANSACTION_AMOUNT}}/g, `${CURRENCY_CODE} ${TRANSACTION_AMOUNT}`);
         html_body = html_body.replace(/{{TRANSACTION_TIME}}/g, PAYMENT_DATE);
         html_body = html_body.replace(/{{VATS}}/g, VATS);

         html_body = html_body.replace('{{GUESTNAME}}',ub.guestinfo.title+"."+ub.guestinfo.first_name+" "+ub.guestinfo.last_name);
         html_body = html_body.replace('{{GUEST_ADDRESS}}',ub.guestinfo.email);
         html_body = html_body.replace('{{GUEST_PHONE}}',ub.guestinfo.mobile);

         html_body = html_body.replace('{{PRINT_URL}}',config.api_url+'print/booking/'+UB._id);//config.api_url+"print/booking/"+UB._id

         const otherPropertyBcc = [];
         if (property.secondaryReservationEmails && property.secondaryReservationEmails.length) {
            property.secondaryReservationEmails
              .split(',')
              .forEach(em => {
                otherPropertyBcc.push({email: em.trim()})
              })
            ;
         }
         msg = {
            // TODO: Enable Emails for production

            // OLD
            // to: property.contactinfo.email,
            // bcc: [{email:config.website_admin_bcc_email},{email:"hotelbookings@stayhopper.com"}],

            // NEW
            // to: property.primaryReservationEmail,
            // bcc: [
            //   {email:config.website_admin_bcc_email},
            //   {email:"hotelbookings@stayhopper.com"},
            //   ...otherPropertyBcc
            // ],

            // TESTING
            to: 'rahul.vagadiya+shproperty@gmail.com',
            bcc: [
              {email:config.website_admin_bcc_email},
              {email:"hotelbookings@stayhopper.com"}
            ],
            from: {
              email: config.website_admin_from_email,
              name: config.fromname
            },
            subject: "Stayhopper:New Booking",
            text: "Stayhopper New Hotel Booking",
            html: html_body
        };
        sgMail.send(msg).catch(e => console.log('error in mailing the hotel', e));
        if (platform === 'web') {
          res.writeHead(301, {
            Location: `${config.website_url}payment/?status=success&booking_id=${ub.book_id}`
          });
          res.end();
        } else {
          return res.json({status});
        }
    } catch(error) {
      console.log('error', error)
      if (platform === 'web') {
        console.log('error in payment', error);
        res.writeHead(301, {
          Location: `${config.website_url}payment/?status=failed&booking_id=${ub.book_id}`
        });
        res.end();
      } else {
        return res.json({error});
      }
    }
});

router.get('/failed', async (req, res) => {
    let booking_id = req.query.booking_id;
    let platform = req.query.platform || 'app'; // 'web' or 'app'
    let promocode = req.query.promocode;
    UB = await UserBooking.findOne({
      _id: booking_id
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
        if (platform === 'web') {
          res.writeHead(301, {
            Location: `${config.website_url}payment/?status=failed&booking_id=${UB.book_id}`
          });
          res.end();
        } else {
          return res.json({status});
        }
    } catch(error) {
      console.log('error', error)
      if (platform === 'web') {
        console.log('error in payment', error);
        res.writeHead(301, {
          Location: `${config.website_url}payment/?status=failed&booking_id=${UB.book_id}`
        });
        res.end();
      } else {
        return res.json({error});
      }
    }
});
module.exports = router;
