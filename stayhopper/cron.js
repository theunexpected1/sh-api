const db = require("mongoose");
const cron = require("node-cron");
const config = require("config");
const UserBooking = require("./db/models/userbookings");
const BookLog = require("./db/models/bookinglogs");
const Booking = require("./db/models/bookings");
const Invoice = require("./db/models/invoices");
const User = require("./db/models/users");
const CompletedBooking = require("./db/models/completedbookings");
const FCM = require("fcm-node");
const moment = require("moment");
const Slot = require("./db/models/slots");
const BookingLog = require("./db/models/bookinglogs");
const blockSlotsModel = require("./db/models/cron_blockslots");
const Room = require("./db/models/rooms");
const Property = require("./db/models/properties");
const Notifications = require("./db/models/notifications");
const NotificationChild = require("./db/models/notification_childs");
const NotificationLog = require('./db/models/notificationlogs');
const _ = require("underscore");

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const fs = require("fs");

//@desc delete booklogs
cron.schedule("*/30 * * * *", async () => { 
  let today = moment().add(-2,'days').format('YYYY-MM-DD');
  await BookingLog.deleteMany({date:{$lt:today}});
  console.log({deleted:'deleted'});
});

// cron.schedule("* * * * * *", async () => {
//   let today = moment().add(-2,'days').format('YYYY-MM-DD');
//   await BookingLog.deleteMany({date:{$lt:today}});
//   console.log({deleted:'deleted'});
// });

//@desc completed bookings
cron.schedule("* * * * *", async () => {
  // return;
  await UserBooking.deleteMany({paid:false,date_checkout:{$lte:new Date()}});
  bookings = await UserBooking.find({ date_checkout: { $lte: new Date() } })
    .populate({
      path: "property",
      populate: [{ path: "contactinfo.country" }, { path: "contactinfo.city" }]
    })
    .populate({
      path: "room.room",
      populate: [{ path: "room_name" }, { path: "room_type" }]
    });
  if (bookings.length > 0) {
    bookings.forEach(async book => {
      let completedBooking = {};
      completedBooking.book_id = book.book_id;
      completedBooking.ub_id = book._id;
      completedBooking.user = book.user;
      completedBooking.guestInfo = book.guestinfo;
      completedBooking.paid = book.paid;
      if (book.property) {
        completedBooking.propertyInfo = {
          id: book.property._id,
          name: book.property.name,
          images: book.property.images,
          country: book.property.contactinfo.country.country,
          city: book.property.contactinfo.city.name,
          address_1: book.property.contactinfo.address_1,
          address_2: book.property.contactinfo.address_2,
          location: book.property.contactinfo.location,
          zip: book.property.contactinfo.zip
        };
      }
      completedBooking.roomsInfo = [];
      book.room.forEach(room => {
        let room_det = room.room;
        let tmp_room = {};
        tmp_room.id = room_det._id;
        tmp_room.images = room_det.images;
        tmp_room.name = room_det.room_name.name;
        if (room.custom_name) {
          tmp_room.name = room_det.custom_name;
        }
        tmp_room.number = room.number;
        tmp_room.type = room_det.room_type.name;
        completedBooking.roomsInfo.push(tmp_room);
      });
      completedBooking.no_of_adults = book.no_of_adults;
      completedBooking.no_of_children = book.no_of_children;
      completedBooking.selected_hours = book.selected_hours;
      completedBooking.checkin_time = book.checkin_time;
      completedBooking.checkin_date = book.checkin_date;
      completedBooking.date_checkin = book.date_checkin;
      completedBooking.date_checkout = book.date_checkout;
      completedBooking.date_booked = book.date_booked;
      completedBooking.tax = book.tax;
      completedBooking.discount = book.discount;
      completedBooking.total_amt = book.total_amt;
      completedBooking.cancel_approval = book.cancel_approval;
      if (book.property)
        completedBooking.latlng = book.property.contactinfo.latlng;

      try {
        await UserBooking.find({ _id: book._id }).remove();
        let user_details = await User.findOne({ _id: book.user });
        if (book.property) {
          let CB = new CompletedBooking(completedBooking);
          await CB.save();
        }
        if (book.cancel_approval != 1) {
          let notification = new Notifications();
          let notification_child = new NotificationChild();
          notification.title = "Review property";
          notification.description = "How was your stay at " + completedBooking.propertyInfo.name + "?";
          notification.book_id = completedBooking.ub_id;
          notification.booking_no = completedBooking.book_id;
          notification.notification_type = "REVIEW";
          notification.device_token = user_details.device_token;
          notification.property_name = book.property.name;
          notification.property_id = book.property._id;
          try{
            await notification.save();
            if(notification._id){
              notification_child.notification_id = notification._id;
              notification_child.user_id = book.user;
              await notification_child.save();
            }
          }catch(error){
            console.log(error);
          }  
          if (user_details.device_token) {
            send_fcm_review(
              user_details.device_type,
              user_details.device_token,
              book.property.name,
              book.property._id,
              book._id,
              notification_child._id
            );
          }  
        }
        console.log({ status: "Success Booking" });
      } catch (error) {
        console.log(error);
      }
    });
  } else {
    // console.log({ status: "Success", message: "No Booking" });
  }
});

//@desc before joining
cron.schedule("*/30 * * * *", async () => {
  const start = moment();
  const remainder = 30 - (start.minute() % 30);
  const dateTime = moment(start).add(remainder, "minutes");
  const today = moment().format("YYYY-MM-DD").toString();
  let slot = moment(dateTime).format("HH:mm");
  let booking = await UserBooking.aggregate([
    {
      $match:{
        paid:true
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user_detail"
      }
    },
    {
      $lookup: {
        from: "properties",
        localField: "property",
        foreignField: "_id",
        as: "property_detail"
      }
    },
    {
      $project: {
        property_detail: "$property_detail",
        user_detail: "$user_detail",
        checkin_time: "$checkin_time",
        checkin_date: "$checkin_date",
        booking_id: "$_id",
        booking_no: "$book_id",
        cancel_approval: "$cancel_approval"
      }
    },
    {
      $project: {
        property_name: "$property_detail.name",
        device_token: "$user_detail.device_token",
        device_type: "$user_detail.device_type",
        name:"$user_detail.name",
        last_name:"$user_detail.last_name",
        email:"$user_detail.email",
        user_id:"$user_detail._id",
        booking_no: "$booking_no",
        checkin_time: "$checkin_time",
        checkin_date: "$checkin_date",
        booking_id: "$_id",
        booking_no: "$booking_no",
        cancel_approval: "$cancel_approval"
      }
    },
    {
      $project: {
        property_name: { $arrayElemAt: ["$property_name", 0] },
        device_token: { $arrayElemAt: ["$device_token", 0] },
        device_type: { $arrayElemAt: ["$device_type", 0] },
        name:"$name",
        last_name:"$last_name",
        email:"$email",
        user_id:"$user_id",
        booking_no:"$booking_no",
        checkin_time: "$checkin_time",
        checkin_date: "$checkin_date",
        booking_id: "$_id",
        cancel_approval: "$cancel_approval"
      }
    },
    {
      $project: {
        property_name: { $ifNull: ["$property_name", ""] },
        device_token: { $ifNull: ["$device_token", false] },
        device_type: "$device_type",
        name:{ $ifNull: ["$name", ""] },
        last_name:{ $ifNull: ["$last_name", ""] },
        email:{ $ifNull: ["$email", ""] },
        user_id:{ $ifNull: ["$user_id", ""] },
        booking_no: { $ifNull: ["$booking_no", ""] },
        checkin_time: "$checkin_time",
        checkin_date: "$checkin_date",
        booking_id: "$_id",
        cancel_approval: "$cancel_approval"
      }
    },
    {
      $match: {
        device_token: { $ne: false }
      }
    },
    {
      $match: {
        checkin_date: today
      }
    },
    {
      $match: {
        checkin_time: slot
      }
    },
    {
      $match: {
        cancel_approval: { $ne: 1 }
      }
    }
  ]);
  let tokens = [];
  if (booking && booking.length > 0) {
    for (var i = 0; i < booking.length; i++) {
      let notification = new Notifications();
      let notification_child = new NotificationChild();
      notification.title = "Booking Notification";
      notification.description = "Your booking at " + booking[i].property_name + " in 30 minutes.";
      notification.book_id = booking[i].booking_id;
      notification.booking_no = booking[i].booking_no;
      notification.notification_type = 'BOOKED';
      notification.device_token = booking[i].device_token;
      try{
        // console.log({testt:booking[i].user_id[0]});
        await notification.save();
        if(notification._id){
          notification_child.notification_id = notification._id;
          notification_child.user_id = booking[i].user_id[0];
          await notification_child.save();
        }
      }catch(error){
        console.log(error);
      }
      let rec = {
        device_type: booking[i].device_type,
        device_token: booking[i].device_token,
        property_name: booking[i].property_name,
        id: booking[i].booking_id,
        notification_id:notification_child._id
      };
      tokens.push(rec);
    }
  }
  send_fcm(tokens);
  // console.log({ status: "Before join" });
});

//delete booking
cron.schedule("* * * * *", async () => {
  // return;
  let booking = await UserBooking.aggregate([
    {
      $match: {
        paid: false
      }
    },
    {
      $match: {
        date_booked: {
          $lte: new Date(moment().add(-10, "minutes"))
        }
      }
    }
  ]);
  let flag = 0;
  for (var i = 0; i < booking.length; i++) {
    book_id = booking[i]._id;
    await Booking.update(
      {},
      { $pull: { slots: { userbooking: book_id } } },
      { multi: true }
    );
    await BookLog.deleteMany({ userbooking: book_id });
    // await UserBooking.deleteOne({ _id: book_id });
    // console.log("delete booking");
  }
  // console.log("delete unpaid booking");
});

//rebooking
cron.schedule("*/30 * * * *", async () => { 
  const start = moment();
  const remainder = 30 - (start.minute() % 30);
  const dateTime = moment(start).add(remainder, "minutes");
  let slot = moment(dateTime).format("HH:mm");
  // slot = '21:00';
  let today = new Date(moment().format("YYYY-MM-DD"));
  let tomorrow = new Date(
    moment()
      .add(1, "day")
      .format("YYYY-MM-DD")
  );

  booking = await UserBooking.aggregate([
    {
      $match: {
        cancel_approval: 0,
        paid:true
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user_detail"
      }
    },
    {
      $project: {
        date_checkout: "$date_checkout",
        no_of_adults: "$no_of_adults",
        rooms: "$room",
        property: "$property",
        user_detail: "$user_detail",
        checkin_time: "$checkin_time",
        checkout_time: "$checkout_time",
        cancel_approval: "$cancel_approval",
        book_no:"$book_id"
      }
    },
    {
      $project: {
        date_checkout: "$date_checkout",
        no_of_adults: "$no_of_adults",
        rooms: "$rooms",
        property: "$property",
        device_token: "$user_detail.device_token",
        device_type: "$user_detail.device_type",
        user_id: "$user_detail._id",
        checkin_time: "$checkin_time",
        checkout_time: "$checkout_time",
        cancel_approval: "$cancel_approval",
        book_no:"$book_no"
      }
    },
    {
      $project: {
        date_checkout: "$date_checkout",
        no_of_adults: "$no_of_adults",
        rooms: "$rooms",
        property: "$property",
        device_token:"$device_token",
        device_type:"$device_type",
        user_id:"$user_id",
        checkin_time: "$checkin_time",
        checkout_time: "$checkout_time",
        cancel_approval: "$cancel_approval",
        book_no:"$book_no"
      }
    },
    {
      $project: {
        date_checkout: "$date_checkout",
        no_of_adults: "$no_of_adults",
        rooms: "$rooms",
        property: "$property",
        device_token: { $ifNull: ["$device_token", false] },
        device_type: "$device_type",
        user_id: '$user_id',
        checkin_time: "$checkin_time",
        checkout_time: "$checkout_time",
        cancel_approval: "$cancel_approval",
        book_no:"$book_no"
      }
    },
    {
      $lookup: {
        from: "properties",
        localField: "property",
        foreignField: "_id",
        as: "property"
      }
    },
    {
      $project: {
        date_checkout: "$date_checkout",
        no_of_adults: "$no_of_adults",
        rooms: "$rooms",
        property: { $arrayElemAt: ["$property", 0] },
        device_token: { $ifNull: ["$device_token", false] },
        device_type: "$device_type",
        user_id: '$user_id',
        checkin_time: "$checkin_time",
        checkout_time: "$checkout_time",
        cancel_approval: "$cancel_approval",
        book_no:"$book_no"
      }
    },
    {
      $project: {
        date_checkout: "$date_checkout",
        no_of_adults: "$no_of_adults",
        rooms: "$rooms",
        property: "$property._id",
        lowest_slot: { $min: "$property.timeslots" },
        device_token: { $ifNull: ["$device_token", false] },
        device_type: "$device_type",
        user_id: '$user_id',
        checkin_time: "$checkin_time",
        checkout_time: "$checkout_time",
        cancel_approval: "$cancel_approval",
        book_no:"$book_no"
      }
    },
    {
      $match: {
        device_token: { $ne: false }
      }
    },
    {
      $match: {
        date_checkout: { $gte: today, $lte: tomorrow }
      }
    },
    {
      $match: {
        checkout_time: slot
      }
    },
    {
      $match: {
        cancel_approval: { $ne: 1 }
      }
    }
  ]);
  let regTokens = [];
  if (booking.length > 0) {
    for (var i = 0; i < booking.length; i++) {
      if (check_extended_booking_availability(booking[i]._id)) {  
        try{
          let notification = new Notifications();
          notification.title = "Extend your stay?";
          notification.description = "Your checkout is in 30 minutes. Do you want to extend?";
          notification.book_id = booking[i]._id;
          notification.booking_no = booking[i].book_no;
          notification.notification_type = 'EXTEND';
          notification.device_token =  booking[i].device_token;
          await notification.save();
          if(notification._id){
            let notification_child = new NotificationChild();
            notification_child.notification_id = notification._id;
            notification_child.user_id = booking[i].user_id;
            await notification_child.save();
            regTokens.push({
              device_token: booking[i].device_token[0],
              device_type: booking[i].device_type[0],
              id: booking[i]._id,
              notification_id:notification_child._id
            });
          }
        }catch(error){
          console.log(error);
        }
        console.log("notification send");
        console.log(moment().format("HH:mm"));
      }
    }
  }
  send_fcm_booking_extension(regTokens);
});

const check_extended_booking_availability = async book_id => {
  let slots = await Slot.find().sort("_id");
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
  let userbooking_id = book_id;
  let userbooking = {};
  if (userbooking_id) {
    userbooking = await UserBooking.findOne({
      _id: userbooking_id,
      cancel_approval: { $ne: 1 }
    })
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
        return 0;
      } else {
        return 1;
      }
    } else {
      return 0;
    }
  } else {
    return 0;
  }
};

const send_fcm = async regTokens => {
  for (i = 0; i < regTokens.length; i++) {
    if (regTokens[i].device_type == "ios") {
      var fcm = new FCM(config.fcm_server_key);
      var message = {
        to: regTokens[i].device_token,
        priority: "high",
        notification: {
          title: "Booking Notification",
          body:
            "Your booking at " + regTokens[i].property_name + " in 30 minutes.",
          priority: "high",
          badge: 0,
          notification_id:regTokens[i].notification_id
        },
        data: {
          type: "BOOK_NOTIFY",
          book_id: regTokens[i].id,
          notification_id:regTokens[i].notification_id
        }
      };
    } else {
      var fcm = new FCM(config.fcm_server_key_android);
      var message = {
        to: regTokens[i].device_token,
        priority: "high",
        notification: {
          title: "Booking Notification",
          body:
            "Your booking at " + regTokens[i].property_name + " in 30 minutes.",
          priority: "high",
          badge: 0,
          click_action: ".DashBoardActivity"
        },
        data: {
          type: "BOOK_NOTIFY",
          book_id: regTokens[i].id,
          notification_id:regTokens[i].notification_id
        }
      };
    }
    fcm.send(message, function(err, response) {
      if (err) {
        console.log("Something has gone wrong!", err);
      } else {
        console.log("Successfully sent with response: ", response);
      }
    });
    let notification_log = new NotificationLog();
    notification_log.device_token = regTokens[i].device_token;
    notification_log.type = "BOOK_NOTIFY";
    notification_log.booking_id = regTokens[i].id;
    notification_log.save();
  }
};

//@desc rebooking
const send_fcm_booking_extension = async regTokens => {
  for (i = 0; i < regTokens.length; i++) {
    if (regTokens[i].device_type == "ios") {
      var fcm = new FCM(config.fcm_server_key);
      var message = {
        to: regTokens[i].device_token,
        priority: "high",
        notification: {
          title: "*Extend your stay?",
          body: "Your checkout is in 30 minutes. Do you want to extend?",
          priority: "high",
          badge: 0,
          notification_id:regTokens[i].notification_id
        },
        data: {
          type: "REBOOKING",
          book_id: regTokens[i].id,
          notification_id:regTokens[i].notification_id
        }
      };
    } else {
      var fcm = new FCM(config.fcm_server_key_android);
      var message = {
        to: regTokens[i].device_token,
        priority: "high",
        notification: {
          title: "Re-Booking Notification",
          body: "Your checkout is in 30 minutes. Do you want to extend?",
          priority: "high",
          badge: 0,
          click_action: ".ReBookingActivity"
        },
        data: {
          type: "REBOOKING",
          book_id: regTokens[i].id,
          notification_id:regTokens[i].notification_id
        }
      };
    }
    fcm.send(message, function(err, response) {
      if (err) {
        console.log("Something has gone wrong!", err);
      } else {
        console.log("Successfully sent with response: ", response);
      }
    });
    let notification_log = new NotificationLog();
    notification_log.device_token = regTokens[i].device_token;
    notification_log.type = "REBOOKING";
    notification_log.booking_id = regTokens[i].id;
    notification_log.save();
  }
};

const send_fcm_review = async (
  device_type,
  token,
  property_name,
  property_id,
  book_id,
  notification_id
) => {
  if (device_type == "ios") {
    var fcm = new FCM(config.fcm_server_key);
    var message = {
      to: token,
      priority: "high",
      notification: {
        title: "Review property",
        body: "How was your stay at " + property_name + "?",
        priority: "high",
        badge: 0,
        notification_id
      },
      data: {
        type: "REVIEW",
        book_id,
        property_name,
        property_id,
        notification_id
      }
    };
  } else {
    var fcm = new FCM(config.fcm_server_key_android);
    var message = {
      to: token,
      priority: "high",
      notification: {
        title: "Review property",
        body: "How was your stay at " + property_name + "?",
        priority: "high",
        badge: 0,
        click_action: ".DashBoardActivity"
      },
      data: {
        type: "REVIEW",
        book_id,
        property_name,
        property_id,
        notification_id
      }
    };
  }
  fcm.send(message, function(err, response) {
    if (err) {
      console.log("Something has gone wrong!", err);
    } else {
      console.log("Successfully sent with response: ", response);
    }
  });
  let notification_log = new NotificationLog();
  notification_log.device_token = token;
  notification_log.type = "BOOK_NOTIFY";
  notification_log.booking_id = book_id;
  notification_log.save();
};

//@desc block slots bulk
cron.schedule("* * * * *", async () => {
  let blockslots = await blockSlotsModel
    .find({ status: 0, block_type: "BLOCK" })
    .limit(5);
  if (blockslots.length > 0) {
    for (m = 0; m < blockslots.length; m++) {
      //get date range
      let from_date = blockslots[m].from_date;
      let to_date = blockslots[m].to_date;
      var from = new Date(from_date);
      var to = new Date(to_date);
      var timeDiff = Math.abs(to.getTime() - from.getTime());
      var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

      let dates = [];
      let startDate = moment(new Date(from)).format("YYYY-MM-DD");
      dates.push(startDate);
      for (var i = 1; i <= diffDays; i++) {
        let date = moment(new Date(from))
          .add(i, "days")
          .format("YYYY-MM-DD");
        dates.push(date);
      }
      //block range
      console.log({ slots: blockslots[m] });
      let room = blockslots[m].room;
      let property = blockslots[m].property;
      let from_slot = blockslots[m].from_slot;
      let to_slot = blockslots[m].to_slot;

      from_slot = await Slot.findOne({ _id: from_slot }).sort({ _id: 1 });
      to_slot = await Slot.findOne({ _id: to_slot }).sort({ _id: 1 });
      let skip = parseInt(from_slot.no);
      let limit = parseInt(to_slot.no);
      let select_slots = await Slot.find()
        .skip(skip - 1)
        .limit(limit - skip + 1)
        .sort({ _id: 1 });
      let select_slot_ids = [];
      select_slots.forEach(slot => {
        select_slot_ids.push(slot._id.toString());
      });

      //check room is provided and get all rooms
      let rooms = [];
      if (room) {
        let room_det = await Room.findOne({ _id: room });
        rooms.push(room_det);
      } else {
        let property_details = await Property.findOne({
          _id: property
        }).populate("rooms");
        rooms = property_details.rooms;
      }
      if (rooms.length <= 0) {
        continue;
      }
      let bookinglogs = [];
      for (l = 0; l < rooms.length; l++) {
        let room = rooms[l]._id;
        // console.log({ room: room });
        for (var j = 0; j < dates.length; j++) {
          // console.log({ date: dates[j] });
          for (var k = 1; k <= rooms[l].number_rooms; k++) {
            // console.log({ room_no: k });
            let booking = await Booking.findOne({ room, date: dates[j] });
            if (!booking) {
              booking = new Booking();
              booking.property = property;
              booking.room = room;
              booking.date = dates[j];
              booking.slots = [];
              for (var i = 0; i < select_slot_ids.length; i++) {
                booking.slots.push({
                  status: "BLOCKED",
                  slot: select_slot_ids[i],
                  number: k
                });
                bookinglogs.push({
                  property: property,
                  room: room,
                  slot: select_slot_ids[i],
                  number: k,
                  date: dates[j],
                  timestamp: new Date(
                    moment(new Date(dates[j])).format("YYYY-MM-DD")
                  )
                });
              }
            } else {
              other_slots = [];
              for (var i = 0; i < booking.slots.length; i++) {
                if (
                  booking.slots[i].status != "BLOCKED" &&
                  booking.slots[i].number == k
                ) {
                  other_slots.push(booking.slots[i].slot.toString());
                }
              }
              for (var i = 0; i < select_slot_ids.length; i++) {
                if (!_.contains(other_slots, select_slot_ids[i].toString())) {
                  booking.slots.push({
                    status: "BLOCKED",
                    slot: select_slot_ids[i],
                    number: k
                  });
                  bookinglogs.push({
                    property: property,
                    room: room,
                    slot: select_slot_ids[i],
                    number: k,
                    date: dates[j],
                    timestamp: new Date(
                      moment(new Date(dates[j])).format("YYYY-MM-DD")
                    )
                  });
                }
              }
            }
            await booking.save();
            // console.log({bookinglogs,booking});
          }
        }
      }
      await BookLog.insertMany(bookinglogs);
      await blockSlotsModel.updateOne(
        { _id: blockslots[m]._id },
        { $set: { status: true } }
      );
      if(blockslots[m].is_last){  
        let html_body = fs.readFileSync("public/slotblockcompleted.html","utf8");
          msg = {
            to:blockslots[m].user_email, 
            bcc: [
              { email: "saleeshprakash@gmail.com" },
              { email: config.website_admin_bcc_email }
            ],
            from: {
              email: config.website_admin_from_email,
              name: config.fromname
            },
            subject: "STAYHOPPER: Your inventory update is live now",
            text: "Your inventory update is live now",
            html: html_body
          };
        sgMail.send(msg); 
      }

    }
  } else {
    // console.log("Nothing to block");
  }
});

// cron.schedule('* * * * *',async()=>{
//   let html_body = fs.readFileSync("public/slotblockcompleted.html","utf8");
//           msg = {
//             to: "saleeshprakash@gmail.com",
//             bcc: [
//               { email: "saleesh.pp@iroidtechnologies.com" },
//               { email: config.website_admin_bcc_email }
//             ],
//             from: config.website_admin_from_email,
//             fromname: config.fromname,
//             subject: "STAYHOPPER: Blocking/Unblocking Completed",
//             text: "Blocking/Unblocking Completed",
//             html: html_body
//           };
//           sgMail.send(msg);  
//           console.log('mail send successfully!');
// });

//@desc unblock slots bulk
cron.schedule("* * * * *", async () => {
  let blockslots = await blockSlotsModel
    .find({ status: 0, block_type: "UNBLOCK" })
    .limit(5);
  if (blockslots.length > 0) {
    for (m = 0; m < blockslots.length; m++) {
      let from_date = blockslots[m].from_date;
      let to_date = blockslots[m].to_date;
      var from = new Date(from_date);
      var to = new Date(to_date);
      var timeDiff = Math.abs(to.getTime() - from.getTime());
      var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
      let dates = [];
      let startDate = moment(new Date(from)).format("YYYY-MM-DD");
      dates.push(startDate);
      for (var i = 1; i <= diffDays; i++) {
        let date = moment(new Date(from))
          .add(i, "days")
          .format("YYYY-MM-DD");
        dates.push(date);
      }

      let room = blockslots[m].room;
      let property = blockslots[m].property;
      let from_slot = blockslots[m].from_slot;
      let to_slot = blockslots[m].to_slot;

      from_slot = await Slot.findOne({ _id: from_slot }).sort({ _id: 1 });
      to_slot = await Slot.findOne({ _id: to_slot }).sort({ _id: 1 });
      let skip = parseInt(from_slot.no);
      let limit = parseInt(to_slot.no);
      let select_slots = await Slot.find()
        .skip(skip - 1)
        .limit(limit - skip + 1)
        .sort({ _id: 1 });
      let select_slot_ids = [];
      select_slots.forEach(slot => {
        select_slot_ids.push(slot._id.toString());
      });

      let rooms = [];
      if (room) {
        let room_det = await Room.findOne({ _id: room });
        rooms.push(room_det);
      } else {
        let property_details = await Property.findOne({
          _id: property
        }).populate("rooms");
        rooms = property_details.rooms;
      }
      if (rooms.length <= 0) {
        continue;
      }
      for (var p = 0; p < rooms.length; p++) {
        for (z = 0; z <= rooms[p].number_rooms; z++) {
          for (q = 0; q < dates.length; q++) {
            room_no = +z + +1;
            let booking = await Booking.findOne({
              room: rooms[p]._id,
              date:dates[q],
              "slots.number": room_no,
              "slots.status": { $eq: "BLOCKED" }
            });
            let bookinglogs = [];
            if (booking) {
              let slots = booking.slots;
              for (var i = 0; i < slots.length; i++) {
                if (
                  slots[i].status == "BLOCKED" &&
                  slots[i].number == room_no &&
                  _.contains(select_slot_ids, slots[i].slot.toString())
                ) {
                  bookinglogs.push({
                    property: rooms[p].property_id,
                    room: rooms[p]._id,
                    slot: slots[i].slot,
                    number: room_no,
                    date:dates[q],
                    timestamp: new Date(
                      moment(new Date(dates[q])).format("YYYY-MM-DD")
                    )
                  });
                  slots.splice(i, 1);
                  i = i - 1;
                  continue;
                }
              }
              // booking.slots = slots;
              deleteFilter = {};
              deleteFilter["$or"] = [];
              for (var i = 0; i < bookinglogs.length; i++) {
                deleteFilter["$or"].push({
                  room: db.Types.ObjectId(bookinglogs[i].room),
                  number: room_no,
                  slot: db.Types.ObjectId(bookinglogs[i].slot)
                });
              }
              if (deleteFilter["$or"].length > 0) {
                await BookLog.deleteMany(deleteFilter);
              }
              await Booking.updateOne({
                room: rooms[p]._id,
                date:dates[q]},
                { $set: {slots:slots} }
              );
            }
          }
        }
      }
      if(typeof blockslots[m] != "undefined"){
        await blockSlotsModel.updateOne(
          { _id: blockslots[m]._id },
          { $set: { status: true } }
        );
        if(blockslots[m].is_last){
          let html_body = fs.readFileSync("public/slotblockcompleted.html","utf8");
          msg = {
            to:blockslots[m].user_email,
            bcc: [
              { email: "saleeshprakash@gmail.com" },
              { email: config.website_admin_bcc_email }
            ],
            from: {
              email: config.website_admin_from_email,
              name: config.fromname
            },
            subject: "STAYHOPPER: Your inventory update is live now",
            text: "Your inventory update is live now",
            html: html_body
          };
          sgMail.send(msg); 
        }  
      }
      // console.log('unblocked');
    }
  } else {
    // console.log("Nothing to unblock");
  }
});