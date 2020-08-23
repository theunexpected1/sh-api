const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const _ = require("underscore");
const momenttz = require("moment-timezone");
const moment = require("moment");
var ObjectId = require("mongodb").ObjectID;
const db = require("mongoose");

const config = require("config");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const fs = require("fs");

const Price = require("../../db/models/pricing");
const Booking = require("../../db/models/bookings");
const UserBooking = require("../../db/models/userbookings");
const CompletedBooking = require("../../db/models/completedbookings");
const Slot = require("../../db/models/slots");
const Room = require("../../db/models/rooms");
const BookingLog = require("../../db/models/bookinglogs");
const Property = require("../../db/models/properties");
const PromoCode = require("../../db/models/promocodes");
const User = require("../../db/models/users");
const curl = new (require("curl-request"))();

let telr = require("telr-payment-nodejs")(
  config.telr_api,
  config.telr_store_id,
  {
    currency: "AED"
  }
);

router.post("/checkpromo", async (req, res) => {
  let user_id = req.body.user;
  let code = req.body.promocode;
  user_id = user_id.trim();
  code = code.trim();
  let promocode = await PromoCode.findOne({ code: code });
  if (promocode && user_id) {
    code = promocode.code;
    let already_applied = await User.findOne({
      _id: user_id,
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

router.post("/", async (req, res) => {
  let data = req.body;
  //form data
  let rooms = [];
  let promocode = data.promocode;
  let payment_amt = parseFloat(data.payment_amt);
  let roomDetails = data.room;
  for (room_id in roomDetails) {
    let room = {
      room: room_id,
      number: roomDetails[room_id]
    };
    rooms.push(room);
  }
  let extra_slots_number = data.extra_slots;

  let userinfo = {
    title: data.title,
    first_name: data.first_name,
    last_name: data.last_name,
    nationality: data.nationality,
    city: data.city,
    mobile: data.mobile,
    email: data.email
  };

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

  let UB = new UserBooking();
  UB.book_id = book_id;
  UB.user = data.user;
  UB.property = data.property;
  UB.room = rooms;
  UB.no_of_adults = data.no_of_adults;
  UB.no_of_children = data.no_of_children;
  UB.selected_hours = data.selected_hours;
  UB.checkin_time = data.checkin_time;
  UB.checkin_date = data.checkin_date;
  var times = new Date(data.checkin_date + " " + data.checkin_time);
  times = moment(times).format("YYYY-MM-DD HH:mm:ss");
  UB.date_checkin = new Date(times);
  times = moment(times).add(data.selected_hours, "hours");
  UB.date_checkout = new Date(times);
  UB.checkout_time = moment(times).format("HH:mm");
  // console.log(UB.date_checkout);

  // return res.json({
  //   checkin:UB.date_checkin,
  //   checkout:UB.date_checkout
  // })

  UB.date_booked = new Date();
  UB.tax = data.tax;
  UB.discount = data.discount;
  UB.total_amt = data.total_amt;
  UB.guestinfo = userinfo;
  UB.trip_type = data.trip_type;

  try {
    await UB.save();
  } catch (error) {
    return res.json({
      status: "Failed",
      message: "Cannot save booking",
      log: error
    });
  }

  // let requested_slots = [];
  let available_rooms = [];
  let booking_slots = [];

  if (UB._id) {
    let checkin_date = data.checkin_date;
    let tmp_date = new Date(checkin_date);
    let checkin_date2 = moment(tmp_date)
      .add(1, "days")
      .format("YYYY-MM-DD");
    let checkin_date3 = moment(tmp_date)
      .add(2, "days")
      .format("YYYY-MM-DD");
    let checkin_time = data.checkin_time;
    let selected_hours = data.selected_hours;

    for (var i = 0; i < rooms.length; i++) {
      let requested_slots = [];
      let requested_slot = await Slot.findOne({ label: checkin_time }).sort({
        _id: 1
      });
      let roomDetails = await Room.findOne({ _id: rooms[i].room });

      let extraslot_cleaning = 1;
      if (roomDetails.extraslot_cleaning) {
        extraslot_cleaning = parseInt(roomDetails.extraslot_cleaning);
      }

      let tot_no_slots = selected_hours * 2 + +extraslot_cleaning;

      if (requested_slot) {
        from = parseInt(requested_slot.no) - 1;
        to = tot_no_slots;
      }

      let requested_slots_day1 = await Slot.find()
        .select("_id")
        .sort({ _id: 1 })
        .skip(from)
        .limit(tot_no_slots);
      let requested_slots_day2 = [];
      let requested_slots_day3 = [];
      if (requested_slots_day1.length < tot_no_slots) {
        let balance_slots = tot_no_slots - requested_slots_day1.length;
        requested_slots_day2 = await Slot.find()
          .select("_id")
          .sort({ _id: 1 })
          .limit(balance_slots);
      }
      if (
        +requested_slots_day1.length + +requested_slots_day2.length <
        tot_no_slots
      ) {
        let balance_slots =
          tot_no_slots -
          (+requested_slots_day1.length + +requested_slots_day2.length);
        requested_slots_day3 = await Slot.find()
          .select("_id")
          .sort({ _id: 1 })
          .limit(balance_slots);
      }
      requested_slots_day1 = requested_slots_day1.map(slot => {
        return slot._id.toString();
      });
      requested_slots.push({
        day: 1,
        date: checkin_date,
        slots: requested_slots_day1
      });
      if (requested_slots_day2.length > 0) {
        requested_slots_day2 = requested_slots_day2.map(slot => {
          return slot._id.toString();
        });
        requested_slots.push({
          day: 2,
          date: checkin_date2,
          slots: requested_slots_day2
        });
      }
      if (requested_slots_day3.length > 0) {
        requested_slots_day3 = requested_slots_day3.map(slot => {
          return slot._id.toString();
        });
        requested_slots.push({
          day: 3,
          date: checkin_date3,
          slots: requested_slots_day3
        });
      }

      let available_room = await checkRoom(
        data.property,
        rooms[i],
        requested_slots
      );

      if (available_room.length > 0) {
        for (var j = 0; j < rooms[i].number; j++) {
          if (requested_slots.length > 0) {
            if (requested_slots[0] && requested_slots[0].slots.length > 0) {
              let booking_slot = {};
              booking_slot.property = db.Types.ObjectId(data.property);
              booking_slot.room = db.Types.ObjectId(rooms[i].room);
              booking_slot.date = requested_slots[0].date;
              booking_slot.userbooking = UB._id;
              let slots = [];
              for (var l = 0; l < requested_slots[0].slots.length; l++) {
                slots.push({
                  status: "BOOKED",
                  slot: db.Types.ObjectId(requested_slots[0].slots[l]),
                  number: Number(available_room[j]),
                  userbooking: UB._id
                });
              }
              if (typeof requested_slots[1] == "undefined") {
                for (
                  var m = +slots.length - +1;
                  m > +slots.length - +1 - +extraslot_cleaning;
                  m--
                ) {
                  slots[m].status = "RESERVED";
                }
              }
              booking_slot.slots = slots;
              booking_slots.push(booking_slot);
            }
            if (requested_slots[1] && requested_slots[1].slots.length > 0) {
              let booking_slot = {};
              booking_slot.property = db.Types.ObjectId(data.property);
              booking_slot.room = db.Types.ObjectId(rooms[i].room);
              booking_slot.date = requested_slots[1].date;
              booking_slot.userbooking = UB._id;
              let slots = [];
              for (var l = 0; l < requested_slots[1].slots.length; l++) {
                slots.push({
                  status: "BOOKED",
                  slot: db.Types.ObjectId(requested_slots[1].slots[l]),
                  number: Number(available_room[j]),
                  userbooking: UB._id
                });
              }
              if (typeof requested_slots[2] == "undefined") {
                for (
                  var m = +slots.length - +1;
                  m > +slots.length - +1 - +extraslot_cleaning;
                  m--
                ) {
                  slots[m].status = "RESERVED";
                }
              }
              booking_slot.slots = slots;
              booking_slots.push(booking_slot);
            }
            if (requested_slots[2] && requested_slots[2].slots.length > 0) {
              let booking_slot = {};
              booking_slot.property = db.Types.ObjectId(data.property);
              booking_slot.room = db.Types.ObjectId(rooms[i].room);
              booking_slot.date = requested_slots[2].date;
              booking_slot.userbooking = UB._id;
              let slots = [];
              for (var l = 0; l < requested_slots[2].slots.length; l++) {
                slots.push({
                  status: "BOOKED",
                  slot: db.Types.ObjectId(requested_slots[2].slots[l]),
                  number: Number(available_room[j]),
                  userbooking: UB._id
                });
              }
              for (
                var m = +slots.length - +1;
                m > +slots.length - +1 - +extraslot_cleaning;
                m--
              ) {
                slots[m].status = "RESERVED";
              }
              booking_slot.slots = slots;
              booking_slots.push(booking_slot);
            }
          }
        }
      } else {
        await Booking.updateMany(
          {},
          { $pull: { slots: { userbooking: UB._id } } },
          { multi: true }
        );
        await UserBooking.deleteOne({ _id: UB._id });
        return res.json({
          status: "Failed",
          message: "Booking not available for your request"
        });
      }
    }
    for (var i = 0; i < booking_slots.length; i++) {
      let booking = await Booking.findOne({
        room: booking_slots[i].room,
        date: booking_slots[i].date
      });
      try {
        if (booking) {
          for (var j = 0; j < booking_slots[i].slots.length; j++) {
            booking.slots.push(booking_slots[i].slots[j]);
          }
          await booking.save();
        } else {
          booking = new Booking(booking_slots[i]);
          await booking.save();
        }
        //add to booking log
        let bookinglogs = [];
        let bookinglog = {};
        for (var j = 0; j < booking_slots[i].slots.length; j++) {
          bookinglog = { ...booking_slots[i].slots[j] };
          bookinglog.property = booking_slots[i].property;
          bookinglog.room = booking_slots[i].room;
          bookinglog.date = booking_slots[i].date;
          bookinglogs.push(bookinglog);
        }
        for (var j = 0; j < bookinglogs.length; j++) {
          bookinglogs[j].timestamp = new Date(
            moment(new Date(bookinglogs[j].date)).format("YYYY-MM-DD")
          );
        }
        await BookingLog.insertMany(bookinglogs);
      } catch (error) {
        await Booking.updateMany(
          {},
          { $pull: { slots: { userbooking: UB._id } } },
          { multi: true }
        );
        await BookingLog.deleteMany({ userbooking: UB._id });
        await UserBooking.deleteOne({ _id: UB._id });
        return res.json({
          status: "Failed",
          message: "Booking not available for your request"
        });
      }
    }
  }
  let return_url = "";
  let ref = "";
  let ts = Math.round(new Date().getTime() / 1000);
  if (!promocode) {
    promocode = "";
  }
  let ivp_test = "1";
  if (data.property.toString() == config.test_property.toString())
    ivp_test = "1";
  curl
    .setBody({
      ivp_method: "create",
      ivp_store: config.telr_store_id,
      ivp_authkey: config.telr_api,
      ivp_cart: ts,
      ivp_test: ivp_test,
      ivp_amount: payment_amt,
      ivp_currency: "AED",
      ivp_desc: "Stayhopper Booking",

      bill_fname: userinfo.first_name,
      bill_sname: userinfo.last_name,
      bill_addr1: userinfo.city,
      bill_city: userinfo.city,
      bill_country: "AE",
      bill_email: userinfo.email,
      phone: userinfo.phone,
      return_auth: config.app_url + "api/payment/success?booking_id=" + UB._id,
      return_can:
        config.app_url +
        "api/payment/failed?booking_id=" +
        UB._id +
        "&promocode=" +
        promocode,
      return_decl:
        config.app_url +
        "api/payment/failed?booking_id=" +
        UB._id +
        "&promocode=" +
        promocode
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
            html_body = html_body.replace("{{SELECTED_HOURS}}", selected_hours);
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
              to: "unpaid@stayhopper.com",
              bcc: [
                { email: "saleeshprakash@gmail.com" },
                { email: config.website_admin_bcc_email }
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
        await BookingLog.deleteMany({ userbooking: UB._id });
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
      await BookingLog.deleteMany({ userbooking: UB._id });
      return res.json({
        status: "Failed",
        message: "Booking could not save successfully!"
      });
    });
});

const checkRoom = async (property, room, requested_slots) => {
  let tot_number = room.number | 0;
  let available_rooms = [];
  for (var i = 0; i < requested_slots.length; i++) {
    let booking_det = await Booking.findOne({
      room: room.room,
      date: requested_slots[i].date
    }).populate("room");
    let number_rooms_available = [];
    if (booking_det) {
      let grouped_slots = _.groupBy(booking_det.slots, "number");
      for (var j = 1; j <= booking_det.room.number_rooms; j++) {
        number_rooms_available.push(j);
      }
      let index = 0;
      for (var number in grouped_slots) {
        let slots = grouped_slots[number].map(slot => {
          return slot.slot.toString();
        });
        let has_intersection = _.intersection(requested_slots[i].slots, slots);
        if (has_intersection.length > 0) {
          number_rooms_available = number_rooms_available.filter(function(el) {
            return !has_intersection.includes(parseInt(number));
          });
          number_rooms_available.splice(index, 1);
        } else {
          index = index + 1;
        }
      }
    } else {
      let room_det = await Room.findOne({ _id: room.room });
      if (tot_number <= room_det.number_rooms) {
        for (var j = 1; j <= room_det.number_rooms; j++) {
          number_rooms_available.push(j);
        }
      }
    }
    available_rooms.push(number_rooms_available);
  }
  let result_rooms = [];
  if (available_rooms.length > 0) {
    if (available_rooms[0].length > 0) {
      result_rooms = available_rooms[0];
    }
    if (available_rooms[1] && available_rooms[1].length > 0) {
      result_rooms = _.intersection(available_rooms[1], result_rooms);
    }
    if (available_rooms[2] && available_rooms[2].length > 0) {
      result_rooms = _.intersection(available_rooms[2], result_rooms);
    }
  }
  return result_rooms;
};

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
    booklog = await BookingLog.aggregate([
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
      let is_exists = await BookingLog.aggregate([
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
            bookinglogs.push(bookinglog);
          }
          for (var j = 0; j < bookinglogs.length; j++) {
            bookinglogs[j].timestamp = new Date(
              moment(new Date(bookinglogs[j].date)).format("YYYY-MM-DD")
            );
          }
          await BookingLog.insertMany(bookinglogs);
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
              config.app_url + "api/payment/success?booking_id=" + UB._id, //config.app_url+"/api/payment/success?booking_id="+UB._id,
            return_can:
              config.app_url + "api/payment/failed?booking_id=" + UB._id, //config.app_url+"/api/payment/failed?booking_id="+UB._id,
            return_decl:
              config.app_url + "api/payment/failed?booking_id=" + UB._id //config.app_url+"/api/payment/failed?booking_id="+UB._id
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
                    to: "unpaid@stayhopper.com",
                    bcc: [
                      { email: "saleeshprakash@gmail.com" },
                      { email: config.website_admin_bcc_email }
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
              await BookingLog.deleteMany({ userbooking: UB._id });
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
            await BookingLog.deleteMany({ userbooking: UB._id });
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
