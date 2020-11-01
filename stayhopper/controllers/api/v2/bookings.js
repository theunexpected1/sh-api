const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const _ = require("underscore");
const momenttz = require("moment-timezone");
const moment = require("moment");
var ObjectId = require("mongodb").ObjectID;
const db = require("mongoose");
const request = require("request");

const config = require("config");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const fs = require("fs");

const Price = require("../../../db/models/pricing");
const Booking = require("../../../db/models/bookings");
const UserBooking = require("../../../db/models/userbookings");
const CompletedBooking = require("../../../db/models/completedbookings");
const Slot = require("../../../db/models/slots");
const Room = require("../../../db/models/rooms");
const BookLog = require("../../../db/models/bookinglogs");
const Property = require("../../../db/models/properties");
const PromoCode = require("../../../db/models/promocodes");
const User = require("../../../db/models/users");
const curl = new (require("curl-request"))();
const axios = require('axios');

const jwtMiddleware = require('../../../middleware/jwt');
const propertiesServices = require('../../../services/properties');
const checkinService = require('../../../services/checkin');
const dateTimeService = require('../../../services/date-time');
curl.default.verbose = true;

// let telr = require("telr-payment-nodejs")(
//   config.telr_api,
//   config.telr_store_id,
//   {
//     currency: "AED"
//   }
// );

router.post("/checkpromo", jwtMiddleware.userAuthenticationRequired, async (req, res) => {
  let userId = req.user._id.toString();
  let code = req.body.promocode;
  userId = userId.trim();
  code = code.trim();
  let promocode = await PromoCode.findOne({ code: code });
  if (promocode && userId) {
    code = promocode.code;
    let already_applied = await User.findOne({
      _id: userId,
      promocodes: code
    }).count();
    if (already_applied) {
      return res.json({
        status: "Failed",
        message: "Promocode doesnot exists"
      });
    } else {
      return res.json({ status: "Success", data: promocode });
    }
  } else {
    return res.json({ status: "Failed", message: "Promocode doesnot exists" });
  }
});

router.post("/test", async (req, res) => {
  console.log('testing...');
  curl
    .setHeaders([
      'Content-Type: multipart/form-data'
    ])
    .setBody({
      content: "test"
    })
    .post('https://api.whadapp.com/post')
    .then(({statusCode, body, headers}) => {
      console.log(statusCode, body, headers)
    })
    .catch(e => {
      console.log('====e', e);
    })
  ;
})

router.post("/", jwtMiddleware.userAuthenticationRequired, async (req, res) => {
  let data = req.body;
  const timezone = req.timezone;
  console.log('===========BOOKING===========');
  console.log('BOOKING: data', data);

  //// 1. Prepare booking related info
  // Transform Rooms info
  let rooms = [];
  let roomDetails = data.room;
  Object.keys(roomDetails).forEach(roomId => {
    rooms.push({room: roomId, number: roomDetails[roomId]})
  });
  console.log('BOOKING: rooms', rooms);

  // User Info
  let userinfo = {
    title: data.title,
    first_name: data.first_name || data.firstName,
    last_name: data.last_name || data.lastName,
    nationality: data.nationality,
    city: data.city,
    mobile: data.mobile,
    email: data.email
  };

  // Generate Booking ID
  let newBookingId = "";
  let lastBooking = await UserBooking.findOne({book_id: {$exists: true}}, null, {sort: { _id: -1 }}); // Find latest
  let lastBookingCompleted = await CompletedBooking.findOne({book_id: {$exists: true}}, null, {sort: { _id: -1 }}); // Find latest
  let bookId = lastBooking && lastBooking.book_id ? lastBooking.book_id : 0;
  let completedBookId = lastBookingCompleted && lastBookingCompleted.book_id ? lastBookingCompleted.book_id : 0;
  if (bookId) {
    const bookId_split = bookId.split('-');
    bookId = bookId_split.length > 1 ? (parseInt(bookId_split[1]) + 1) : 0
  }
  if (completedBookId) {
    const completedBookId_split = completedBookId.split('-');
    completedBookId = completedBookId_split.length > 1 ? (parseInt(completedBookId_split[1]) + 1) : 0
  }

  newBookingId = Math.max(bookId, completedBookId);
  newBookingId = newBookingId
    ? `SH-${newBookingId}`
    : `SH-1000`
  ;

  let promocode = data.promocode;
  const checkinDateMoment = moment(`${data.checkinDate} ${data.checkinTime}`, 'DD/MM/YYYY HH:mm');
  const checkoutDateMoment = moment(`${data.checkoutDate} ${data.checkoutTime}`, 'DD/MM/YYYY HH:mm');
  const accurateStayDurationLabel = checkinService.getAccurateStayDurationLabel({
    checkinDate: data.checkinDate,
    checkoutDate: data.checkoutDate,
    checkinTime: data.checkinTime,
    checkoutTime: data.checkoutTime
  });
  let additionalStayDurationInfo = '';
  if (data.bookingType === 'monthly') {
    let numDays = checkoutDateMoment.diff(checkinDateMoment, 'days');
    // Since we're sure it's standard checkin checkout (based on times), add an additional buffer day
    // This is because 12pm to 2pm next day isn't technically 1 full day, so we add an extra day to not be short of actual days
    if ((data.checkinTime === '14:00') && (data.checkoutTime === '12:00')) {
      numDays++;
    }
    additionalStayDurationInfo = ` ( ${numDays} days )`;
  }
  const stayDuration = accurateStayDurationLabel + additionalStayDurationInfo;

  //// 2. Prepare User Booking
  let UB = new UserBooking();
  UB.book_id = newBookingId;
  UB.user = req.user._id;
  UB.property = data.property;
  UB.room = rooms;
  UB.no_of_adults = data.numberAdults;
  UB.no_of_children = data.numberChildren;
  UB.guestinfo = userinfo;
  if (data.trip_type) {
    UB.trip_type = data.trip_type;
  }

  // Transform format
  UB.checkin_date = moment(data.checkinDate, 'DD/MM/YYYY').format('YYYY-MM-DD');
  UB.checkin_time = data.checkinTime;
  UB.checkout_date = moment(data.checkoutDate, 'DD/MM/YYYY').format('YYYY-MM-DD');
  UB.checkout_time = data.checkoutTime;
  UB.bookingType = data.bookingType;
  UB.stayDuration = stayDuration;
  UB.date_checkin = checkinDateMoment.toDate();
  UB.date_checkout = checkoutDateMoment.toDate();
  UB.date_booked = new Date();

  // Payment related
  UB.currencyCode = data.currencyCode;
  UB.tax = data.tax;
  // Booking fee / convenience fee
  UB.bookingFee = parseInt(data.bookingFee);
  UB.discount = data.discount;
  // UB.discount = data.discount
  //   ? parseInt(data.bookingFee) * (parseInt(data.discount) / 100)
  //   : data.discount
  // ;

  // Room rate across dates
  UB.total_amt = data.total_amt || data.totalAmt;

  // This is what the user is actually paying
  const paymentAmt = parseFloat(data.payment_amt || data.paymentAmt);
  // Calculate payment amount on the server
  // Hourly: Pay Booking Fee
  // Monthly: Pay Booking Fee + Full Room rate
  // let serverCalculatedPaymentAmt = parseInt(data.bookingFee);
  // if (UB.discount) {
  //   serverCalculatedPaymentAmt = parseInt(data.bookingFee) - UB.discount;
  // }
  UB.paymentAmt = paymentAmt;

  // Booking fee / convenience fee
  UB.bookingFee = parseInt(data.bookingFee);

  try {
    await UB.save();
  } catch (error) {
    return res.json({
      status: "Failed",
      message: "Cannot save booking",
      log: error
    });
  }

  let bookingSlots = [];

  if (UB._id) {
    const allSlots = await Slot.find({}).select('_id label').lean();
    const datesAndHoursStayParams = checkinService.getDatesAndHoursStayParams({
      checkinDate: data.checkinDate,
      checkoutDate: data.checkoutDate,
      checkinTime: data.checkinTime,
      checkoutTime: data.checkoutTime,
    });
    console.log('BOOKINGS: datesAndHoursStayParams', datesAndHoursStayParams);

    //// 3. Check each rooms availability and then book the slots, alongwith cleaning slots
    // For each room
      // Check availability of the room
      // For each date
        // - book the slots in bookingSlot
    // Block cleaning slots after the last booking slot
    for (var i = 0; i < rooms.length; i++) {

      // Prepare cleaning hours booking slot (For status RESERVED)
      let roomDetails = await Room.findOne({ _id: rooms[i].room });
      let datesAndHoursStayParamsForCleaning = [];
      if (roomDetails.hours_cleaning) {
        const cleaningStartDateMoment = moment(`${data.checkoutDate} ${data.checkoutTime}`, 'DD/MM/YYYY HH:mm');
        const cleaningEndDateMoment = moment(cleaningStartDateMoment).add(roomDetails.hours_cleaning, 'hour');
        datesAndHoursStayParamsForCleaning = checkinService.getDatesAndHoursStayParams({
          checkinDate: moment(cleaningStartDateMoment).format('DD/MM/YYYY'),
          checkoutDate: moment(cleaningEndDateMoment).format('DD/MM/YYYY'),
          checkinTime: moment(cleaningStartDateMoment).format('HH:mm'),
          checkoutTime: moment(cleaningEndDateMoment).format('HH:mm')
        });
        console.log(`====Room:${(i+1)}`, 'datesAndHoursStayParamsForCleaning', datesAndHoursStayParamsForCleaning);
      }
  
      // Get available room numbers that can be booked (there may be 8 rooms in inventory, but only 3 rooms available, which could be room # 2, 5 and 8)
      // availableRoomNumbers in this case would be [2, 5, 8]
      let availableRoomNumbers = [];
      const checkRoomParams = {
        checkinDate: data.checkinDate,
        checkoutDate: data.checkoutDate,
        checkinTime: data.checkinTime,
        checkoutTime: data.checkoutTime,
        bookingType: data.bookingType || 'hourly', // hourly or monthly
        // numberAdults: parseInt(data.numberAdults) || 2,
        // numberChildren: parseInt(data.numberChildren) || 0,
        numberRooms: parseInt(rooms[i].number) || 1,
        rooms: rooms[i].room.toString(),
        timezone
      };
      // console.log(`====Room:${(i+1)}`, 'checkRoomParams', checkRoomParams);
      const propertiesWithRoomRatesAndAvailability = await propertiesServices.getProperties(checkRoomParams);
      // console.log(`====Room:${(i+1)}`, 'propertiesWithRoomRatesAndAvailability.count', propertiesWithRoomRatesAndAvailability.count);
      if (propertiesWithRoomRatesAndAvailability && propertiesWithRoomRatesAndAvailability.count) {
        const targetRoom = propertiesWithRoomRatesAndAvailability.list[0].rooms.find(r => r._id.toString() === rooms[i].room.toString());
        // console.log(`====Room:${(i+1)}`, 'targetRoom priceSummary', JSON.stringify(targetRoom.priceSummary));
        // if (data.bookingType === 'monthly') {
        //   serverCalculatedPaymentAmt += parseInt((targetRoom.priceSummary.base.amount * parseInt(rooms[i].number)))
        // }

        // Only non-blocked rooms are available
        if (targetRoom.blockedRoomNumbers && targetRoom.blockedRoomNumbers.length) {
          for (let currNum = 1; currNum <= targetRoom.number_rooms; currNum++) {
            if (targetRoom.blockedRoomNumbers.indexOf(currNum) === -1) {
              availableRoomNumbers.push(currNum);
            }
          }
        } else {
          // All rooms are available
          for (let currNum = 1; currNum <= targetRoom.number_rooms; currNum++) {
            availableRoomNumbers.push(currNum);
          }
        }
      }

      console.log(`====Room:${(i+1)}`, 'requested numberOfRooms', typeof rooms[i].number, rooms[i].number, 'available numberOfRooms', availableRoomNumbers.length);

      // Proceed if we have rooms avaiable
      if (!!availableRoomNumbers && (availableRoomNumbers.length >= rooms[i].number)) {
        for (var j = 0; j < rooms[i].number; j++) {

          // Book slots as "BOOKED"
          if (datesAndHoursStayParams.length) {
            for (let k = 0; k < datesAndHoursStayParams.length; k++) {
              // Use hours as-is in case of Full Day (start to end for the given day)
              if (datesAndHoursStayParams[k].rateType === 'fullDay') {
                let bookingSlot = {};
                bookingSlot.property = db.Types.ObjectId(data.property);
                bookingSlot.room = db.Types.ObjectId(rooms[i].room);
                bookingSlot.date = moment(datesAndHoursStayParams[k].date, 'DD/MM/YYYY').format('YYYY-MM-DD');
                bookingSlot.userbooking = UB._id;
                let slots = [];
                for (let l = 0; l < datesAndHoursStayParams[k].hours.length; l++) {
                  // Find the slot from the label 
                  const targetSlot = allSlots.find(s => s.label === datesAndHoursStayParams[k].hours[l]);
                  if (targetSlot && targetSlot._id) {
                    slots.push({
                      status: "BOOKED",
                      slot: db.Types.ObjectId(targetSlot._id),
                      number: Number(availableRoomNumbers[j]),
                      userbooking: UB._id
                    });
                  }
                }
                bookingSlot.slots = slots;
                bookingSlots.push(bookingSlot);
              } else if (datesAndHoursStayParams[k].rateType === 'standardDay') {
                // Use hours from 2 dates in case of Standard Day (2pm to 12am for day 1, then 12am to 12pm for day 2)
                const standardDayDatesAndHours = [{
                    date: moment(datesAndHoursStayParams[k].date, 'DD/MM/YYYY').format('YYYY-MM-DD'),
                    hours: dateTimeService.getHoursFromTo('14:00', '00:00')
                  }, {
                    date: moment(datesAndHoursStayParams[k].date, 'DD/MM/YYYY').add(1, 'day').format('YYYY-MM-DD'),
                    hours: dateTimeService.getHoursFromTo('00:00', '12:00')
                  }
                ]
                // console.log(`standardDayDatesAndHours for ${datesAndHoursStayParams[k].date}`, standardDayDatesAndHours);
                for (let m = 0; m < standardDayDatesAndHours.length; m++) {
                  let bookingSlot = {};
                  bookingSlot.property = db.Types.ObjectId(data.property);
                  bookingSlot.room = db.Types.ObjectId(rooms[i].room);
                  bookingSlot.date = standardDayDatesAndHours[m].date;
                  bookingSlot.userbooking = UB._id;
                  let slots = [];
                  for (let l = 0; l < standardDayDatesAndHours[m].hours.length; l++) {
                    // Find the slot from the label 
                    const targetSlot = allSlots.find(s => s.label === standardDayDatesAndHours[m].hours[l]);
                    if (targetSlot && targetSlot._id) {
                      slots.push({
                        status: "BOOKED",
                        slot: db.Types.ObjectId(targetSlot._id),
                        number: Number(availableRoomNumbers[j]),
                        userbooking: UB._id
                      });
                    }
                  }
                  bookingSlot.slots = slots;
                  bookingSlots.push(bookingSlot);
                }
              }
            }
          }

          // Book Slots as "RESERVED" for cleaning slots
          if (datesAndHoursStayParamsForCleaning && datesAndHoursStayParamsForCleaning.length) {
            for (let k = 0; k < datesAndHoursStayParamsForCleaning.length; k++) {
              // Use hours as-is (as it's definitely the case of Full Day for cleaning hours)
              let bookingSlot = {};
              bookingSlot.property = db.Types.ObjectId(data.property);
              bookingSlot.room = db.Types.ObjectId(rooms[i].room);
              bookingSlot.date = moment(datesAndHoursStayParamsForCleaning[k].date, 'DD/MM/YYYY').format('YYYY-MM-DD');
              bookingSlot.userbooking = UB._id;
              let slots = [];
              for (let l = 0; l < datesAndHoursStayParamsForCleaning[k].hours.length; l++) {
                // Find the slot from the label 
                const targetSlot = allSlots.find(s => s.label === datesAndHoursStayParamsForCleaning[k].hours[l]);
                if (targetSlot && targetSlot._id) {
                  slots.push({
                    status: "RESERVED",
                    slot: db.Types.ObjectId(targetSlot._id),
                    number: Number(availableRoomNumbers[j]),
                    userbooking: UB._id
                  });
                }
              }
              bookingSlot.slots = slots;
              bookingSlots.push(bookingSlot);
            }
          }


          // DEBUG: To print
          // console.log('bookingSlots', JSON.stringify(bookingSlots.map(bs => {
          //   bs.slots.map(bss => {
          //     const ts = allSlots.find(s => s._id.toString() === bss.slot.toString());
          //     if (ts) {
          //       bss.slot = ts.label;
          //     }
          //     return bss;
          //   })
          //   return bs;
          // })));

        }
      } else {
        await Booking.updateMany(
          {},
          { $pull: { slots: { userbooking: UB._id } } },
          { multi: true }
        );
        await UserBooking.deleteOne({ _id: UB._id });
        return res
          .status(404)
          .json({
            status: "Failed",
            message: "Booking not available for your request"
          })
        ;
      }
    }

    // Ensure the pricing from frontend matches server generated pricing
    // console.log(`====Room:${(i+1)}`, 'requested paymentAmt', typeof paymentAmt, paymentAmt, 'serverCalculatedPaymentAmt', typeof serverCalculatedPaymentAmt, serverCalculatedPaymentAmt);
    // if (serverCalculatedPaymentAmt !== paymentAmt) {
    //   await Booking.updateMany(
    //     {},
    //     { $pull: { slots: { userbooking: UB._id } } },
    //     { multi: true }
    //   );
    //   await UserBooking.deleteOne({ _id: UB._id });
    //   return res
    //     .status(404)
    //     .json({
    //       status: "Failed",
    //       message: "The prices for the room has changed, please start fresh."
    //     })
    //   ;
    // }

    let bookingsAdded = 0;
    let bookingLogsAdded = 0;
    let bookingsUpdated = 0;
    let bookingLogsUpdated = 0;
    // Save the accumulated booking slots
    for (var i = 0; i < bookingSlots.length; i++) {
      let booking = await Booking.findOne({
        room: bookingSlots[i].room,
        date: bookingSlots[i].date
      });
      try {
        if (booking) {
          for (var j = 0; j < bookingSlots[i].slots.length; j++) {
            booking.slots.push(bookingSlots[i].slots[j]);
          }
          bookingsUpdated++;
          await booking.save();
        } else {
          booking = new Booking(bookingSlots[i]);
          bookingsAdded++;
          await booking.save();
        }
        //add to booking log
        let bookinglogs = [];
        let bookinglog = {};
        const allSlots = await Slot.find({});
        for (var j = 0; j < bookingSlots[i].slots.length; j++) {
          bookinglog = { ...bookingSlots[i].slots[j] };
          bookinglog.property = bookingSlots[i].property;
          bookinglog.room = bookingSlots[i].room;
          bookinglog.date = bookingSlots[i].date;
          const slotRecord = allSlots.find(s => s._id.toString() === bookingSlots[i].slots[j].toString());
          const slotLabel = slotRecord ? slotRecord.label : '00:00';
          bookinglog.slotStartTime = moment(`${bookingSlots[i].date} ${slotLabel}`, 'YYYY-MM-DD HH:mm').toDate();
          bookinglog.timestamp = moment(bookinglog.date, 'YYYY-MM-DD').toDate();
          bookinglogs.push(bookinglog);
        }
        bookingLogsAdded += bookinglogs.length;
        await BookLog.insertMany(bookinglogs);
      } catch (error) {
        console.log('ERRRR error', error);
        await Booking.updateMany(
          {},
          { $pull: { slots: { userbooking: UB._id } } },
          { multi: true }
        );
        await BookLog.deleteMany({ userbooking: UB._id });
        await UserBooking.deleteOne({ _id: UB._id });
        return res.json({
          status: "Failed",
          message: "Booking not available for your request"
        });
      }
    }
  }

  //// 4. Initiate payment

  console.log('BOOKING: Booking saved, initiate payment');
  let return_url = "";
  let ref = "";
  let ts = Math.round(new Date().getTime() / 1000);
  if (!promocode) {
    promocode = "";
  }
  // By default: we're testing
  let ivp_test = "1";
  // If it's Production / Live mode, we're not testing
  if (config.payment_mode && config.payment_mode === 'live') {
    ivp_test = 0;
  }

  try {
    return request
      .post({
        url: 'https://secure.telr.com/gateway/order.json',
        form: {
          ivp_method: "create",
          ivp_store: config.telr_store_id,
          ivp_authkey: config.telr_api,
          ivp_cart: ts,
          ivp_test: ivp_test,
          ivp_amount: paymentAmt,
          ivp_currency: "AED",
          ivp_desc: "Stayhopper Booking",
  
          bill_fname: userinfo.first_name,
          bill_sname: userinfo.last_name,
          bill_addr1: userinfo.city,
          bill_city: userinfo.city,
          bill_country: "AE",
          bill_email: userinfo.email,
          phone: userinfo.mobile,
          return_auth: `${config.api_url}api/payment/success?booking_id=${UB._id}`,
          return_can: `${config.api_url}api/payment/failed?booking_id=${UB._id}&promocode="${promocode}`,
          return_decl: `${config.api_url}api/payment/failed?booking_id=${UB._id}&promocode=${promocode}`
        }
      }, async (e, resp, body) => {
        if (e) {
          console.log('Error in initiating payment', e);
          await Booking.updateMany(
            {},
            { $pull: { slots: { userbooking: UB._id } } },
            { multi: true }
          );
          await UserBooking.deleteOne({ _id: UB._id });
          await BookLog.deleteMany({ userbooking: UB._id });
          return res.json({
            status: "Failed",
            message: "Booking could not save successfully!"
          });
        }

        console.log('Response from initiating payment', JSON.parse(body));
        let obj = JSON.parse(body);
        if (typeof obj.order != "undefined") {
          return_url = obj.order.url;
          ref = obj.order.ref;
          UB.ref = ref;
          try {
            await UB.save();
            if (promocode) {
              let user = await User.findOne({ _id: data.user });
              if (user) {
                let promocodes = user.promocodes;
                if (typeof promocodes != "undefined") {
                  promocodes.push(promocode);
                  user.promocodes = promocodes;
                } else {
                  user.promocodes = promocode;
                }
                try {
                  await user.save();
                } catch (error) {
                  console.log(error);
                }
              }
            }

            //send payment alert to admin
            /////////////////////////////
            let userbooking = await UserBooking.findOne({ _id: UB._id })
              .populate("property")
              .populate({ path: "room.room", populate: { path: "room_type" } });
            let hotel_name = userbooking.property.name;
            let STAY_DURATION = userbooking.stayDuration;
            // Capitalize first letter
            let BOOKING_TYPE = userbooking.bookingType
                ? userbooking.bookingType.charAt(0).toUpperCase() + userbooking.bookingType.substring(1)
                : ''
              ;
            let guest_name =
              userbooking.guestinfo.title +
              ". " +
              userbooking.guestinfo.first_name +
              " " +
              userbooking.guestinfo.last_name;
            let book_id = userbooking.book_id;
            let date = userbooking.checkin_date + " " + userbooking.checkin_time;
            let user_mobile = userbooking.guestinfo.mobile;
            let booked_property = hotel_name;
            let booked_property_address =
              userbooking.property.contactinfo.location;
            let booked_property_email = userbooking.property.contactinfo.email;
            let booked_property_phone = userbooking.property.contactinfo.mobile;
            let selected_hours = userbooking.selected_hours;

            let booked_room_types = "";
            let rooms = userbooking.room;
            for (var i = 0; i < rooms.length; i++) {
              booked_room_types += rooms[i].room.room_type.name;
            }
            if (booked_room_types) {
              booked_room_types = booked_room_types.replace(/,\s*$/, "");
            }
            date = moment(date).format("dddd YYYY-MM-DD HH:mm");
            let CHECKIN_DATE = moment(userbooking.date_checkin).format(
              "dddd DD-MM-YYYY | hh:mm A"
            );
            let CHECKOUT_DATE = moment(userbooking.date_checkout).format(
              "dddd DD-MM-YYYY | hh:mm A"
            );
            if (userbooking) {
              userbooking.cancel_request = 1;
              await userbooking.save();
              let html_body = fs.readFileSync("public/paymentcancelled.html", "utf8");

              html_body = html_body.replace(/{{USERNAME}}/g, guest_name);
              html_body = html_body.replace(/{{HOTEL_NAME}}/g, hotel_name);
              html_body = html_body.replace(/{{BOOKID}}/g, book_id);
              html_body = html_body.replace(/{{DATE}}/g, date);
              html_body = html_body.replace(/{{BOOKING_TYPE}}/g, BOOKING_TYPE);
              html_body = html_body.replace(/{{STAY_DURATION}}/g, STAY_DURATION);
              html_body = html_body.replace(/{{USER_MOBILE}}/g, user_mobile);
              html_body = html_body.replace(/{{BOOKED_PROPERTY}}/g, booked_property);
              html_body = html_body.replace(/{{BOOKED_PROPERTY_ADDRESS}}/g, booked_property_address);
              html_body = html_body.replace(/{{BOOKED_PROPERTY_PHONE}}/g, booked_property_phone);
              html_body = html_body.replace(/{{SELECTED_HOURS}}/g, selected_hours);
              html_body = html_body.replace(/{{BOOKED_ROOM_TYPES}}/g, booked_room_types);
              html_body = html_body.replace(/{{CHECKIN_DATE}}/g, CHECKIN_DATE);
              html_body = html_body.replace(/{{CHECKOUT_DATE}}/g, CHECKOUT_DATE);
              html_body = html_body.replace(/{{HOTEL_CONTACT_NUMBER}}/g, booked_property_phone);
              html_body = html_body.replace(/{{HOTEL_EMAIL}}/g, booked_property_email);

              // TODO: Enable Emails for production
              msg = {
                // NEW
                // to: "unpaid@stayhopper.com",
                // bcc: [
                //   { email: config.unpaid },
                //   { email: config.website_admin_bcc_email }
                // ],

                // TESTING
                to: "unpaid@stayhopper.com",
                bcc: [
                  { email: config.unpaid },
                  { email: config.website_admin_bcc_email },
                  { email: 'rahul.vagadiya+shunpaid@gmail.com' }
                ],
                from: {
                  email: config.website_admin_from_email,
                  name: config.fromname
                },
                subject: "STAYHOPPER: New Booking Payment Alert",
                text: "Booking Payment Alert",
                html: html_body
              };

              sgMail.send(msg);
            }

            ///////////////////
            //end payment alert

            return res.json({
              status: "Success",
              message: "Booking saved successfully!",
              payment_link: return_url,
              booking_id: UB._id,
              book_id: UB.book_id,
              ref: obj.order.ref
            });
          } catch (error) {
            console.log('err', error);
            return res.json({
              status: "Failed",
              message: "Booking could not save ssuccessfully!"
            });
          }
        } else {
          await Booking.updateMany(
            {},
            { $pull: { slots: { userbooking: UB._id } } },
            { multi: true }
          );
          await UserBooking.deleteOne({ _id: UB._id });
          await BookLog.deleteMany({ userbooking: UB._id });
          return res.json({
            status: "Failed",
            message: "Booking could not save successfully!"
          });
        }
      })
    ;
  } catch (e) {
    console.log('caught ', e)
  }
});

/**
router.post("/extendedbooking", async (req, res) => {
  let slots = await Slot.find().sort({ _id: 1 });
  let all_timeslots = [
    "00:00",
    "00:30",
    "01:00",
    "01:30",
    "02:00",
    "02:30",
    "03:00",
    "03:30",
    "04:00",
    "04:30",
    "05:00",
    "05:30",
    "06:00",
    "06:30",
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
    "22:00",
    "22:30",
    "23:00",
    "23:30"
  ];
  let slosts_array = [];
  for (let i = 0; i < slots.length; i++) {
    slosts_array.push(db.Types.ObjectId(slots[i]._id));
  }
  //get userbooking id
  let userbooking_id = req.body.book_id;
  let isUserBookingExists = UserBooking.findOne({
    _id: userbooking_id
  }).count();
  if (!isUserBookingExists) {
    return res.json({
      status: "Failed",
      message: "Rebooking time exceeded, cannot extend booking!"
    });
  }
  let amt_payable = req.body.amt_payable;
  let promocode = req.body.promocode;

  let userbooking = {};
  if (userbooking_id) {
    userbooking = await UserBooking.findOne({ _id: userbooking_id })
      .populate("property")
      .populate("room.room");
  }
  if (userbooking) {
    booklog = await BookLog.aggregate([
      {
        $match: {
          userbooking: userbooking._id
        }
      },
      {
        $group: {
          _id: {
            room: "$room"
          },
          room_nos: {
            $addToSet: "$number"
          }
        }
      },
      {
        $project: {
          room: "$_id.room",
          room_nos: "$room_nos"
        }
      }
    ]);
    booked_rooms = [];
    for (var i = 0; i < booklog.length; i++) {
      booked_rooms.push({
        room: booklog[i].room,
        room_nos: booklog[i].room_nos
      });
    }

    property = userbooking.property;
    timeslots = property.timeslots;
    timeslot = _.min(timeslots);
    room_details = userbooking.room;
    rooms = [];
    if (room_details) {
      for (var i = 0; i < room_details.length; i++) {
        let room = {};
        room.id = room_details[i].room._id;
        room.extraslots = room_details[i].room.extraslot_cleaning;
        room.number = room_details[i].number;
        room.price = room_details[i].room.price["h" + timeslot];
        let room_nos = _.find(booked_rooms, function(item) {
          return item.room.toString() == room_details[i].room._id.toString();
        });
        room.room_nos = room_nos.room_nos;
        rooms.push(room);
      }
      let no_of_adults = userbooking.no_of_adults;
      let no_of_children = userbooking.no_of_children;
      let selected_hours = userbooking.selected_hours;
      let date_checkin = userbooking.date_checkout;
      let checkin_date = moment(date_checkin).format("YYYY-MM-DD");
      let checkin_time = moment(date_checkin).format("HH:mm");
      let date_checkout = moment(date_checkin).add(3, "hours");
      let date_booked = new Date();

      let firstIndex = all_timeslots.indexOf(checkin_time, 0);
      firstIndex = firstIndex;
      // return res.json({status:1,firstIndex,checkin_time});
      let firstslot = slosts_array[firstIndex];
      let filter = [];
      let requested_slots = [];
      for (var i = 0; i < rooms.length; i++) {
        let number_slots_required = timeslot * 2 + rooms[i].extraslots;
        requested_slots1 = slosts_array.slice(
          firstIndex,
          firstIndex + number_slots_required
        );
        // return res.json(requested_slots1);
        requested_slots.push({
          slots: requested_slots1,
          date: checkin_date
        });
        if (number_slots_required > requested_slots1.length) {
          number_slots_required =
            number_slots_required - requested_slots1.length;
          requested_slots2 = slosts_array.slice(0, number_slots_required);
          let date2 = moment(checkin_date)
            .add(1, "days")
            .format("YYYY-MM-DD");
          requested_slots.push({
            slots: requested_slots2,
            date: date2
          });
          if (requested_slots2 < number_slots_required) {
            number_slots_required =
              number_slots_required - requested_slots.length;
            requested_slots3 = slosts_array.slice(0, number_slots_required);
            let date3 = moment(date2)
              .add(1, "days")
              .format("YYYY-MM-DD");
            requested_slots.push({
              slots: requested_slots3,
              date: date3
            });
          }
        }
        // return res.json({nons:rooms[i].room_nos});
        for (j = 0; j < rooms[i].room_nos.length; j++) {
          for (k = 0; k < requested_slots.length; k++) {
            filter.push({
              $and: [
                { slot: { $in: requested_slots[k].slots } },
                { date: requested_slots[k].date },
                { number: rooms[i].room_nos[j] },
                { room: db.Types.ObjectId(rooms[i].id) },
                { userbooking: { $ne: db.Types.ObjectId(userbooking_id) } }
              ]
            });
          }
        }
      }
      let is_exists = await BookLog.aggregate([
        {
          $match: {
            $or: filter
          }
        },
        {
          $count: "exist"
        }
      ]);
      if (is_exists.length <= 0) {
        //book here
        let last_booking = await UserBooking.findOne().sort({ _id: -1 });
        let last_booking_completed = await CompletedBooking.findOne().sort({
          _id: -1
        });
        let book_id = "";
        let completed_book_id = "";
        if (last_booking || last_booking_completed) {
          if (last_booking) book_id = last_booking.book_id;
          if (last_booking_completed)
            completed_book_id = last_booking_completed.book_id;
          if (book_id) {
            let book_nos = book_id.split("-");
            book_id = 0;
            if (book_nos.length > 1) {
              book_id = parseInt(book_nos[1]) + +1;
            }
          }
          if (completed_book_id) {
            let completed_book_nos = completed_book_id.split("-");
            completed_book_id = 0;
            if (completed_book_nos.length > 1) {
              completed_book_id = parseInt(completed_book_nos[1]) + +1;
            }
          }
          if (book_id < completed_book_id) {
            book_id = completed_book_id;
          }
          if (book_id) {
            book_id = "SH-" + book_id;
          } else {
            book_id = "SH-1000";
          }
        } else {
          book_id = "SH-1000";
        }

        lastbooked = await UserBooking.findOne({ _id: userbooking_id })
          .lean()
          .exec();
        UB = new UserBooking();
        UB.date_booked = new Date();
        UB.discount = +config.booking_charge - +amt_payable;
        UB.parent_id = lastbooked._id;
        UB.book_id = book_id;
        UB.guestinfo = lastbooked.guestinfo;
        UB.trip_type = lastbooked.trip_type;
        UB.room = lastbooked.room;
        UB.user = lastbooked.user;
        UB.property = lastbooked.property;
        UB.no_of_adults = lastbooked.no_of_adults;
        UB.no_of_children = lastbooked.no_of_children;
        UB.selected_hours = timeslot;
        UB.checkin_date = checkin_date;
        UB.checkin_time = checkin_time;
        UB.date_checkin = new Date(checkin_date + " " + UB.checkin_time);
        times = moment(UB.date_checkin).add(UB.selected_hours, "hours");
        UB.date_checkout = new Date(times);
        UB.checkout_time = moment(times).format("HH:mm");
        let total_price = 0;
        for (var i = 0; i < rooms.length; i++) {
          custom_price = await Price.findOne({
            from: { $lte: new Date() },
            to: { $gte: new Date() },
            room: db.Types.ObjectId(rooms[i].id)
          }).sort({ _id: -1 });
          // return res.json({custom_price});
          if (custom_price) {
            if (custom_price["h" + selected_hours]) {
              rooms[i].price = custom_price["h" + selected_hours];
              total_price += rooms[i].price * rooms[i].room_nos.length;
            }
          } else {
            total_price += rooms[i].price * rooms[i].room_nos.length;
          }
        }
        UB.total_amt = total_price;
        await UB.save();
        let bookings = [];

        for (var i = 0; i < filter.length; i++) {
          booking = {};
          booking.slots = filter[i]["$and"][0].slot["$in"];
          booking.date = filter[i]["$and"][1].date;
          booking.number = filter[i]["$and"][2].number;
          booking.room = filter[i]["$and"][3].room;
          booking.userbooking = filter[i]["$and"][4].userbooking["$ne"];
          booking.property = lastbooked.property;
          bookings.push(booking);
        }

        for (var i = 0; i < bookings.length; i++) {
          let booking = await Booking.findOne({
            room: bookings[i].room,
            date: bookings[i].date
          });
          // return res.json(booking);
          if (!booking) {
            booking = new Booking();
            booking.property = bookings[i].property;
            booking.room = bookings[i].room;
            booking.date = bookings[i].date;
          }
          let slots_day = [];
          for (var j = 0; j < bookings[i].slots.length; j++) {
            let slot = {};
            slot.slot = bookings[i].slots[j];
            if (j < timeslot * 2) {
              slot.status = "BOOKED";
            } else {
              slot.status = "RESERVED";
            }
            slot.number = bookings[i].number;
            slot.userbooking = UB._id;
            slots_day.push(slot);
          }
          // return res.json(slots_day);

          if (booking.slots.length > 0) {
            booking.slots.push(...slots_day);
          } else {
            booking.slots = slots_day;
          }
          await booking.save();
          await Booking.updateMany(
            {},
            {
              $pull: {
                slots: { userbooking: lastbooked._id, status: "RESERVED" }
              }
            },
            { multi: true }
          );
          //add to booking log
          let bookinglogs = [];
          let bookinglog = {};
          for (var j = 0; j < slots_day.length; j++) {
            bookinglog = { ...slots_day[j] };
            bookinglog.property = booking.property;
            bookinglog.room = booking.room;
            bookinglog.date = booking.date;
            const slotRecord = slots.find(s => s._id.toString() === slots_day[j].slot.toString());
            const slotLabel = slotRecord ? slotRecord.label : '00:00';
            bookinglog.slotStartTime = moment(`${booking.date} ${slotLabel}`, 'YYYY-MM-DD HH:mm');
            bookinglogs.push(bookinglog);
          }
          for (var j = 0; j < bookinglogs.length; j++) {
            bookinglogs[j].timestamp = new Date(
              moment(new Date(bookinglogs[j].date)).format("YYYY-MM-DD")
            );
          }
          await BookLog.insertMany(bookinglogs);
        }
        let ivp_test = "1";
        if (booking.property.toString() == config.test_property.toString())
          ivp_test = "1";
        let return_url = "";
        let ref = "";
        let ts = Math.round(new Date().getTime() / 1000);
        curl
          .setBody({
            ivp_method: "create",
            ivp_store: config.telr_store_id,
            ivp_authkey: config.telr_api,
            ivp_cart: ts,
            ivp_test: ivp_test,
            ivp_amount: parseInt(amt_payable),
            ivp_currency: "AED",
            ivp_desc: "Stayhopper Booking",
            bill_fname: UB.guestinfo.first_name,
            bill_sname: UB.guestinfo.last_name,
            bill_addr1: UB.guestinfo.city,
            bill_city: UB.guestinfo.city,
            bill_country: "AE",
            bill_email: UB.guestinfo.email,
            return_auth:
              config.api_url + "api/payment/success?booking_id=" + UB._id, //config.api_url+"/api/payment/success?booking_id="+UB._id,
            return_can:
              config.api_url + "api/payment/failed?booking_id=" + UB._id, //config.api_url+"/api/payment/failed?booking_id="+UB._id,
            return_decl:
              config.api_url + "api/payment/failed?booking_id=" + UB._id //config.api_url+"/api/payment/failed?booking_id="+UB._id
          })
          .post("https://secure.telr.com/gateway/order.json")
          .then(async ({ statusCode, body, headers }) => {
            console.log(body);
            let obj = JSON.parse(body);
            if (typeof obj.order != "undefined") {
              return_url = obj.order.url;
              ref = obj.order.ref;
              UB.ref = ref;
              try {
                await UB.save();
                if (promocode) {
                  let user = await User.findOne({ _id: UB.user });
                  if (user) {
                    let promocodes = user.promocodes;
                    if (typeof promocodes != "undefined") {
                      promocodes.push(promocode);
                      user.promocodes = promocodes;
                    } else {
                      user.promocodes = promocode;
                    }
                    try {
                      await user.save();
                    } catch (error) {
                      console.log(error);
                    }
                  }
                }

                //send payment alert to admin
                /////////////////////////////
                let userbooking = await UserBooking.findOne({ _id: UB._id })
                  .populate("property")
                  .populate({
                    path: "room.room",
                    populate: { path: "room_type" }
                  });
                let hotel_name = userbooking.property.name;
                let guest_name =
                  userbooking.guestinfo.title +
                  ". " +
                  userbooking.guestinfo.first_name +
                  " " +
                  userbooking.guestinfo.last_name;
                let book_id = userbooking.book_id;
                let date =
                  userbooking.checkin_date + " " + userbooking.checkin_time;
                let user_mobile = userbooking.guestinfo.mobile;
                let booked_property = hotel_name;
                let booked_property_address =
                  userbooking.property.contactinfo.location;
                let booked_property_email =
                  userbooking.property.contactinfo.email;
                let booked_property_phone =
                  userbooking.property.contactinfo.mobile;
                let selected_hours = userbooking.selected_hours;
                let booked_room_types = "";
                let rooms = userbooking.room;
                for (var i = 0; i < rooms.length; i++) {
                  booked_room_types += rooms[i].room.room_type.name;
                }
                if (booked_room_types) {
                  booked_room_types = booked_room_types.replace(/,\s*$/, "");
                }
                date = moment(date).format("dddd YYYY-MM-DD HH:mm");
                let booked_date = date;
                if (userbooking) {
                  userbooking.cancel_request = 1;
                  await userbooking.save();
                  let html_body = fs.readFileSync(
                    "public/paymentcancelled.html",
                    "utf8"
                  );

                  html_body = html_body.replace("{{USERNAME}}", guest_name);
                  html_body = html_body.replace("{{HOTEL_NAME}}", hotel_name);
                  html_body = html_body.replace("{{BOOKID}}", book_id);
                  html_body = html_body.replace("{{DATE}}", date);
                  html_body = html_body.replace("{{USER_MOBILE}}", user_mobile);
                  html_body = html_body.replace(
                    "{{BOOKED_PROPERTY}}",
                    booked_property
                  );
                  html_body = html_body.replace(
                    "{{BOOKED_PROPERTY_ADDRESS}}",
                    booked_property_address
                  );
                  html_body = html_body.replace(
                    "{{BOOKED_PROPERTY_PHONE}}",
                    booked_property_phone
                  );
                  html_body = html_body.replace(
                    "{{SELECTED_HOURS}}",
                    selected_hours
                  );
                  html_body = html_body.replace(
                    "{{BOOKED_ROOM_TYPES}}",
                    booked_room_types
                  );
                  html_body = html_body.replace("{{BOOKED_DATE}}", booked_date);
                  html_body = html_body.replace(
                    "{{HOTEL_CONTACT_NUMBER}}",
                    booked_property_phone
                  );
                  html_body = html_body.replace(
                    "{{HOTEL_EMAIL}}",
                    booked_property_email
                  );

                  msg = {
                    // TODO: Email
                    to: "rahul.vagadiya@gmail.com",
                    // to: "unpaid@stayhopper.com",
                    // bcc: [
                    //   { email: "saleeshprakash@gmail.com" },
                    //   { email: config.website_admin_bcc_email }
                    // ],
                    from: {
                      email: config.website_admin_from_email,
                      name: config.fromname
                    },
                    subject: "STAYHOPPER: New Booking Payment Alert",
                    text: "Booking Payment Alert",
                    html: html_body
                  };

                  sgMail.send(msg);
                }

                ///////////////////
                //end payment alert

                return res.json({
                  status: "Success",
                  message: "Booking saved successfully!",
                  payment_link: return_url,
                  booking_id: UB._id,
                  book_id: UB.book_id
                });
              } catch (error) {
                return res.json({
                  status: "Failed",
                  message: "Booking could not save successfully!"
                });
              }
            } else {
              await Booking.updateMany(
                {},
                { $pull: { slots: { userbooking: UB._id } } },
                { multi: true }
              );
              await UserBooking.deleteOne({ _id: UB._id });
              await BookLog.deleteMany({ userbooking: UB._id });
              return res.json({
                status: "Failed",
                message: "Booking could not save successfully!"
              });
            }
          })
          .catch(async e => {
            console.log(e);
            await Booking.updateMany(
              {},
              { $pull: { slots: { userbooking: UB._id } } },
              { multi: true }
            );
            await UserBooking.deleteOne({ _id: UB._id });
            await BookLog.deleteMany({ userbooking: UB._id });
            return res.json({
              status: "Failed",
              message: "Booking could not save successfully!"
            });
          });
      } else {
        return res.json({
          status: "Failed",
          message: "Could not extend booking"
        });
      }
    } else {
      return res.json({ status: "Failed", message: "Userbooking not exists" });
    }
  } else {
    return res.json({ status: "Failed", message: "Userbooking not exists" });
  }
});
*/

router.get("/booking_det", async (req, res) => {
  let book_id = req.query.book_id;
  let booking_details = await UserBooking.findOne({ _id: book_id })
    .populate("property")
    .lean()
    .exec();
  if (!booking_details) {
    return res.json({ status: "Failed", message: "Booking expired!" });
  }
  let min_slot = _.min(booking_details.property.timeslots);
  rooms = booking_details.room;
  total_price = 0;
  for (var i = 0; i < rooms.length; i++) {
    let custom_price = await Price.findOne({
      room: rooms[i].room,
      from_date: { $gte: new Date() },
      to_date: { $lte: new Date() }
    });
    let room_details = await Room.findOne({ _id: rooms[i].room }).populate(
      "room_type"
    );
    let price = room_details.price["h" + min_slot];
    if (custom_price) {
      if (custom_price["h" + min_slot]) {
        price = custom_price["h" + min_slot];
      }
    }
    rooms[i].price = price;
    total_price += parseFloat(price);
    rooms[i].room_type = room_details.room_type.name;
  }
  booking_details.room = rooms;
  booking_details.rebooking_price = config.rebooking_amt;
  booking_details.rebooking_total = total_price;
  booking_details.smallest_slot = min_slot;
  return res.json(booking_details);
});

module.exports = router;
