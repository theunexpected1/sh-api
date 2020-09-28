const db = require("../../db/mongodb");
const express = require("express");
const router = express.Router();

const Property = require("../../db/models/properties");
const Booking = require("../../db/models/bookings");
const Slot = require("../../db/models/slots");
const City = require("../../db/models/cities");
const Price = require("../../db/models/pricing");
const Room = require("../../db/models/rooms");
const UserRating = require("../../db/models/userratings");
const UserBooking = require("../../db/models/userbookings");
const BookLog = require("../../db/models/bookinglogs");
const Notifications = require("../../db/models/notifications");
const NotificationChild = require("../../db/models/notification_childs");
const NotificationLog = require('../../db/models/notificationlogs');

const _ = require("underscore");
const moment = require("moment");
const geodist = require("geodist");

const FCM = require("fcm-node");

var fs = require("fs");
const config = require("config");

router.post("/booking", async (req, res) => {
  let property_id = req.query.property;
  let number_adults = req.query.number_adults;
  let selected_hours = req.query.selected_hours;
  let checkin_time = req.query.checkin_time;
  let checkin_date = req.query.checkin_date;
  let city = req.query.city;
  let number_rooms = req.query.number_rooms;
  let filter_service = [];
  if (req.query.service) filter_service = req.query.service.split(",");
  let filter_rating = [];
  if (req.query.rating) filter_rating = req.query.rating.split(",");
  for (var i = 0; i < filter_rating.length; i++) {
    filter_rating[i] = db.Types.ObjectId(filter_rating[i]);
  }
  // let filter_rating = req.query.rating;
  let filter_price = req.query.price;
  let sort = parseInt(req.query.sort_rating);
  let sort_popular = 0;
  let sort_rating = 0;
  let sort_price = 0;
  switch (sort) {
    case 1:
      sort_popular = 1;
      break;
    case 2:
      sort_rating = 1;
      break;
    case 3:
      sort_price = 1;
      break;
    default:
      sort_popular = 1;
  }
  let lat = 0;
  let lng = 0;
  if (req.query.location) {
    let tmp_loc = req.query.location.split(",");
    lat = tmp_loc[0];
    lng = tmp_loc[1];
  }
  let number_slots_required = selected_hours * 2 + 1;
  let slots = await Slot.find();
  let timeslots = [
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
    slosts_array.push(slots[i]._id);
  }
  let firstIndex = timeslots.indexOf(checkin_time, 0);
  let requested_slots = [];
  requested_slots1 = slosts_array.slice(
    firstIndex,
    firstIndex + number_slots_required
  );
  requested_slots.push({
    slots: requested_slots1,
    date: checkin_date
  });
  if (number_slots_required > requested_slots1.length) {
    // console.log({number_slots_required,slots1:requested_slots1.length});
    number_slots_required = number_slots_required - requested_slots1.length;
    requested_slots2 = slosts_array.slice(0, number_slots_required);
    let date2 = moment(checkin_date)
      .add(1, "days")
      .format("YYYY-MM-DD");
    requested_slots.push({
      slots: requested_slots2,
      date: date2
    });
    if (requested_slots2 < number_slots_required) {
      // console.log({number_slots_required,slots2:requested_slots2.length});
      number_slots_required = number_slots_required - requested_slots.length;
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

  booklogfilter = [];
  for (var i = 0; i < requested_slots.length; i++) {
    booklogfilter.push({
      $and: [
        { slot: { $in: requested_slots[i].slots } },
        { date: requested_slots[i].date }
      ]
    });
  }

  let lastslot_array = requested_slots[requested_slots.length - 1];
  let last_slot = lastslot_array.slots[lastslot_array.slots.length - 1];
  let last_slot_index = slosts_array.indexOf(last_slot, 0);
  last_slot_index = +last_slot_index + +1;
  let last_day = lastslot_array.date;
  let next_Day = moment(last_day)
    .add(1, "days")
    .format("YYYY-MM-DD");

  let tmpFilter = [];
  let extraslot_filter = [];

  //1
  let extraslotarray1 = [];
  let extraslot1 = [];
  let extraslot2 = [];
  extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 1);
  if (extraslot1.length > 0) {
    extraslotarray1.push({
      slots: extraslot1,
      date: last_day
    });
  }
  if (1 > extraslot1.length) {
    number_slots_required = 1 - extraslot1.length;
    extraslot2 = slosts_array.slice(0, number_slots_required);
    extraslotarray1.push({
      slots: extraslot2,
      date: next_Day
    });
  }

  for (var i = 0; i < extraslotarray1.length; i++) {
    booklogfilter.push({
      $and: [
        { slot: { $in: extraslotarray1[i].slots } },
        { date: extraslotarray1[i].date },
        { extraslots: 1 }
      ]
    });
  }

  //2
  let extraslotarray2 = [];
  extraslot1 = [];
  extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 2);
  if (extraslot1.length > 0) {
    extraslotarray2.push({
      slots: extraslot1,
      date: last_day
    });
  }
  if (2 > extraslot1.length) {
    number_slots_required = 2 - extraslot1.length;
    extraslot2 = slosts_array.slice(0, number_slots_required);
    extraslotarray2.push({
      slots: extraslot2,
      date: next_Day
    });
  }

  for (var i = 0; i < extraslotarray2.length; i++) {
    booklogfilter.push({
      $and: [
        { slot: { $in: extraslotarray2[i].slots } },
        { date: extraslotarray2[i].date },
        { extraslots: 2 }
      ]
    });
  }

  //3
  let extraslotarray3 = [];
  extraslot1 = [];
  extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 3);
  if (extraslot1.length > 0) {
    extraslotarray3.push({
      slots: extraslot1,
      date: last_day
    });
  }
  if (3 > extraslot1.length) {
    number_slots_required = 3 - extraslot1.length;
    extraslot2 = slosts_array.slice(0, number_slots_required);
    extraslotarray3.push({
      slots: extraslot2,
      date: next_Day
    });
  }

  for (var i = 0; i < extraslotarray3.length; i++) {
    booklogfilter.push({
      $and: [
        { slot: { $in: extraslotarray3[i].slots } },
        { date: extraslotarray3[i].date },
        { extraslots: 3 }
      ]
    });
  }

  //4
  let extraslotarray4 = [];
  extraslot1 = [];
  extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 4);
  if (extraslot1.length > 0) {
    extraslotarray4.push({
      slots: extraslot1,
      date: last_day
    });
  }
  if (4 > extraslot1.length) {
    number_slots_required = 4 - extraslot1.length;
    extraslot2 = slosts_array.slice(0, number_slots_required);
    extraslotarray4.push({
      slots: extraslot2,
      date: next_Day
    });
  }

  for (var i = 0; i < extraslotarray4.length; i++) {
    booklogfilter.push({
      $and: [
        { slot: { $in: extraslotarray4[i].slots } },
        { date: extraslotarray4[i].date },
        { extraslots: 4 }
      ]
    });
  }

  //5
  let extraslotarray5 = [];
  extraslot1 = [];
  extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 5);
  if (extraslot1.length > 0) {
    extraslotarray5.push({
      slots: extraslot1,
      date: last_day
    });
  }
  if (5 > extraslot1.length) {
    number_slots_required = 5 - extraslot1.length;
    extraslot2 = slosts_array.slice(0, number_slots_required);
    extraslotarray5.push({
      slots: extraslot2,
      date: next_Day
    });
  }
  for (var i = 0; i < extraslotarray5.length; i++) {
    booklogfilter.push({
      $and: [
        { slot: { $in: extraslotarray5[i].slots } },
        { date: extraslotarray5[i].date },
        { extraslots: 5 }
      ]
    });
  }

  //bookinglog
  let bookingLogMasterFilter = [
    {
      $lookup: {
        from: "rooms",
        localField: "room",
        foreignField: "_id",
        as: "room_details"
      }
    },
    {
      $addFields: {
        extraslots: { $arrayElemAt: ["$room_details.extraslot_cleaning", 0] }
      }
    },
    {
      $match: {
        $or: booklogfilter
      }
    },
    {
      $group: {
        _id: {
          property: "$property",
          room: "$room"
        },
        number: { $addToSet: "$number" }
      }
    },
    {
      $lookup: {
        from: "rooms",
        localField: "_id.room",
        foreignField: "_id",
        as: "room_details"
      }
    },
    {
      $addFields: {
        blockedrooms: { $size: "$number" },
        total_rooms: { $arrayElemAt: ["$room_details.number_rooms", 0] },
        extraslots: { $arrayElemAt: ["$room_details.extraslot_cleaning", 0] }
      }
    },
    {
      $addFields: {
        balance_rooms: { $subtract: ["$total_rooms", "$blockedrooms"] }
      }
    },
    {
      $group: {
        _id: {
          room: "$_id.room"
        },
        blockedrooms: { $sum: "$blockedrooms" }
      }
    }
  ];

  let blocked_properties_result = await BookLog.aggregate(
    bookingLogMasterFilter
  );

  let blocked_properties_array = [];
  for (var i = 0; i < blocked_properties_result.length; i++) {
    blocked_properties_array.push({
      room: blocked_properties_result[i]._id.room,
      blockedrooms: blocked_properties_result[i].blockedrooms
    });
  }
  custom_pricings_raw = await Price.aggregate([
    {
      $match: {
        from: { $lte: new Date() }
      }
    },
    {
      $match: {
        to: { $gte: new Date() }
      }
    },
    {
      $sort: {
        _id: -1
      }
    },
    {
      $group: {
        _id: { room: "$room" },
        h3: { $addToSet: "$h3" },
        h6: { $addToSet: "$h6" },
        h12: { $addToSet: "$h12" },
        h24: { $addToSet: "$h24" }
      }
    },
    {
      $project: {
        room: "$_id.room",
        h3: { $arrayElemAt: ["$h3", 0] },
        h6: { $arrayElemAt: ["$h6", 0] },
        h12: { $arrayElemAt: ["$h12", 0] },
        h24: { $arrayElemAt: ["$h24", 0] }
      }
    }
  ]);

  custom_pricings = [];
  if (custom_pricings_raw.length > 0) {
    for (var i = 0; i < custom_pricings_raw.length; i++) {
      let cust_price = 0;
      switch (selected_hours) {
        case "3":
          cust_price = custom_pricings_raw[i].h3;
          break;
        case "6":
          cust_price = custom_pricings_raw[i].h6;
          break;
        case "12":
          cust_price = custom_pricings_raw[i].h12;
          break;
        case "24":
          cust_price = custom_pricings_raw[i].h24;
          break;
      }
      if (parseFloat(cust_price) > 0) {
        custom_pricings.push({
          room: custom_pricings_raw[i].room,
          price: parseFloat(cust_price)
        });
      }
    }
  }
  // return res.json({custom_pricings});

  let available_properties_filter = [];
  if (city) {
    available_properties_filter.push({
      $match: {
        "contactinfo.city": db.Types.ObjectId(city.trim())
      }
    });
  } else {
    available_properties_filter.push({
      $geoNear: {
        near: { type: "Point", coordinates: [parseInt(lng), parseInt(lat)] },
        key: "location",
        spherical: true,
        distanceMultiplier: 0.001,
        distanceField: "distance"
      }
    });
  }
  available_properties_filter.push(
    {
      $match: {
        _id: db.Types.ObjectId(property_id)
      }
    },
    {
      $match: {
        approved: true
      }
    },
    {
      $match: {
        published: true
      }
    },
    {
      $addFields: {
        timeslot_exists: {
          $in: [parseInt(selected_hours), "$timeslots"]
        }
      }
    },
    {
      $match: {
        timeslot_exists: true
      }
    },
    {
      $lookup: {
        from: "rooms",
        localField: "rooms",
        foreignField: "_id",
        as: "room_details"
      }
    },
    {
      $lookup: {
        from: "property_ratings",
        localField: "rating",
        foreignField: "_id",
        as: "rating"
      }
    }
  );
  let service_exists_filter = true;
  if (filter_service.length > 0) {
    service_exists_filter = {};
    service_exists_filter["$or"] = [];
    for (var i = 0; i < filter_service.length; i++) {
      service_exists_filter["$or"].push({
        $in: [db.Types.ObjectId(filter_service[i]), "$services"]
      });
    }
  }
  available_properties_filter.push(
    {
      $unwind: "$room_details"
    },
    {
      $addFields: {
        services: {
          $cond: {
            if: {
              $ne: [{ $type: "$room_details.services" }, "array"]
            },
            then: [],
            else: "$room_details.services"
          }
        }
      }
    },
    {
      $project: {
        name: "$name",
        images: "$images",
        rating: "$rating",
        timeslots: "$timeslots",
        user_rating: "$user_rating",
        room_id: "$room_details._id",
        number_rooms: "$room_details.number_rooms",
        room_detail: "$room_details",
        distance: "$distance",
        location: "$contactinfo.location",
        latlng: "$contactinfo.latlng",
        service_exists: service_exists_filter,
        blocked_properties_array: blocked_properties_array
      }
    }
  );
  if (filter_service.length > 0) {
    available_properties_filter.push({
      $match: {
        service_exists: true
      }
    });
  }
  available_properties_filter.push(
    {
      $project: {
        name: "$name",
        images: "$images",
        rating: "$rating",
        timeslots: "$timeslots",
        user_rating: "$user_rating",
        room_id: "$room_id",
        number_rooms: "$number_rooms",
        room_detail: "$room_detail",
        distance: "$distance",
        location: "$location",
        latlng: "$latlng",
        blocked_properties_array: {
          $filter: {
            input: "$blocked_properties_array",
            as: "blocked_properties_array",
            cond: { $eq: ["$$blocked_properties_array.room", "$room_id"] }
          }
        }
      }
    },
    {
      $addFields: {
        blockedrooms: {
          $arrayElemAt: ["$blocked_properties_array.blockedrooms", 0]
        },
        custom_pricings_array: custom_pricings
      }
    },
    {
      $project: {
        name: "$name",
        images: "$images",
        rating: "$rating",
        timeslots: "$timeslots",
        user_rating: "$user_rating",
        room_id: "$room_id",
        number_rooms: "$number_rooms",
        room_detail: "$room_detail",
        distance: "$distance",
        location: "$location",
        latlng: "$latlng",
        blockedrooms: {
          $ifNull: ["$blockedrooms", 0]
        },
        custom_pricings_array: {
          $filter: {
            input: "$custom_pricings_array",
            as: "custom_pricings_array",
            cond: { $eq: ["$$custom_pricings_array.room", "$room_id"] }
          }
        }
      }
    },
    {
      $addFields: {
        available_rooms: { $subtract: ["$number_rooms", "$blockedrooms"] },
        default_price: "$room_detail.price.h" + selected_hours,
        custom_pricing: { $arrayElemAt: ["$custom_pricings_array", 0] }
      }
    },
    {
      $match: {
        available_rooms: { $ne: 0 }
      }
    },
    {
      $project: {
        name: "$name",
        images: "$images",
        rating: { $arrayElemAt: ["$rating", 0] },
        timeslots: "$timeslots",
        user_rating: "$user_rating",
        room_id: "$room_id",
        number_rooms: "$number_rooms",
        room_detail: "$room_detail",
        distance: "$distance",
        blockedrooms: "$blockedrooms",
        available_rooms: "$available_rooms",
        default_price: "$default_price",
        custom_price: "$custom_pricing.price",
        location: "$location",
        latlng: "$latlng"
      }
    },
    {
      $addFields: {
        current_price: { $ifNull: ["$custom_price", "$default_price"] }
      }
    },
    {
      $match: {
        current_price: { $gte: 0 }
      }
    }
  );
  if (filter_price) {
    filter_price = filter_price.split(",");
    from = parseFloat(filter_price[0]);
    to = parseFloat(filter_price[1]);
    available_properties_filter.push({
      $match: {
        current_price: { $gte: from, $lte: to }
      }
    });
  }
  if (parseInt(number_rooms) == 1) {
    available_properties_filter.push({
      $match: {
        "room_detail.number_guests": { $gte: parseInt(number_adults) }
      }
    });
  }
  available_properties_filter.push(
    {
      $project: {
        name: "$name",
        images: "$images",
        rating: "$rating",
        timeslots: "$timeslots",
        user_rating: "$user_rating",
        distance: "$distance",
        rooms: {
          _id: "$room_id",
          price: "$default_price",
          custom_price: "$custom_price",
          available_rooms: "$available_rooms",
          blocked_rooms: "$blockedrooms",
          current_price: "$current_price"
        },
        contactinfo: {
          location: "$location",
          latlng: "$latlng"
        }
      }
    },
    {
      $sort: {
        "rooms.current_price": -1
      }
    }
  );
  available_properties_filter.push(
    {
      $group: {
        _id: { property: "$_id" },
        name: { $addToSet: "$name" },
        images: { $addToSet: "$images" },
        rating: { $addToSet: "$rating" },
        timeslots: { $addToSet: "$timeslots" },
        user_rating: { $addToSet: "$user_rating" },
        distance: { $addToSet: "$distance" },
        rooms: { $addToSet: "$rooms" },
        contactinfo: { $addToSet: "$contactinfo" },
        minprice: { $min: "$rooms.current_price" },
        maxprice: { $max: "$rooms.current_price" },
        available_rooms: { $sum: "$rooms.available_rooms" }
      }
    },
    {
      $project: {
        _id: "$_id.property",
        name: { $arrayElemAt: ["$name", 0] },
        images: { $arrayElemAt: ["$images", 0] },
        rating: { $arrayElemAt: ["$rating", 0] },
        timeslots: { $arrayElemAt: ["$timeslots", 0] },
        user_rating: { $arrayElemAt: ["$user_rating", 0] },
        distance: { $arrayElemAt: ["$distance", 0] },
        rooms: "$rooms",
        contactinfo: { $arrayElemAt: ["$contactinfo", 0] },
        minprice: "$minprice",
        maxprice: "$maxprice",
        available_rooms: "$available_rooms"
      }
    },
    {
      $match: {
        available_rooms: { $gte: parseInt(number_rooms) }
      }
    }
  );
  for (var i = 0; i < filter_rating.length; i++) {
    available_properties_filter.push({
      $match: {
        "rating._id": filter_rating[i]
      }
    });
  }
  if (sort_rating) {
    available_properties_filter.push({
      $sort: {
        "rating.value": -1
      }
    });
  }
  if (sort_popular) {
    available_properties_filter.push({
      $sort: {
        user_rating: -1
      }
    });
  }
  if (sort_price) {
    available_properties_filter.push({
      $sort: {
        minprice: 1
      }
    });
  }
  let available_properties = await Property.aggregate(
    available_properties_filter
  );
  return res.json({
    status: 1,
    available_properties
  });
});

router.get("/reserveall", async (req, res) => {
  //get id
  let id = req.query.id;
  if (!id) {
    return res.json({ status: 0, message: "Could not reserve booking" });
  }
  //check room exists
  let roomdet = await Room.findOne({ _id: id });
  if (!roomdet) {
    return res.json({ status: 0, message: "Could not reserve booking" });
  }

  // return res.json({roomdet});

  let date = req.query.date;
  date = moment(new Date(date)).format("YYYY-MM-DD");

  for (z = 0; z <= roomdet.number_rooms; z++) {
    console.log({z});
    room_no = +z + +1;
    let room = roomdet._id;
    let property = roomdet.property_id;
    let select_slots = await Slot.find().sort({ _id: 1 });
    let select_slot_ids = [];
    select_slots.forEach(slot => {
      select_slot_ids.push(slot._id.toString());
    });

    let booking = await Booking.findOne({ room, date });
    let bookinglogs = [];
    if (!booking) {
      booking = new Booking();
      booking.property = property;
      booking.room = room;
      booking.date = date;
      booking.slots = [];
      for (var i = 0; i < select_slot_ids.length; i++) {
        booking.slots.push({
          status: "BLOCKED",
          slot: select_slot_ids[i],
          number: room_no
        });
        bookinglogs.push({
          property: property,
          room: room,
          slot: select_slot_ids[i],
          number: room_no,
          date: date,
          timestamp: new Date(moment(new Date(date)).format("YYYY-MM-DD"))
        });
      }
    } else {
      other_slots = [];
      for (var i = 0; i < booking.slots.length; i++) {
        if (
          booking.slots[i].status != "BLOCKED" &&
          booking.slots[i].number == room_no
        ) {
          other_slots.push(booking.slots[i].slot.toString());
        }
      }
      for (var i = 0; i < select_slot_ids.length; i++) {
        console.log(!_.contains(other_slots, select_slot_ids[i].toString()));
        if (!_.contains(other_slots, select_slot_ids[i].toString())) {
          booking.slots.push({
            status: "BLOCKED",
            slot: select_slot_ids[i],
            number: room_no
          });
          const slotRecord = select_slots.find(s => s._id.toString() === select_slot_ids[i].toString());
          const slotLabel = slotRecord ? slotRecord.label : '00:00';
          const slotStartTime = moment(`${date} ${slotLabel}`, 'YYYY-MM-DD HH:mm');
          bookinglogs.push({
            property: property,
            room: room,
            slot: select_slot_ids[i],
            number: room_no,
            date,
            slotStartTime,
            timestamp: new Date(moment(new Date(date)).format("YYYY-MM-DD"))
          });
        }
      }
    }
    await BookLog.insertMany(bookinglogs);
    await booking.save();
  }
  return res.json({ status: 1 });
});

//@desc before joining
router.get('/beforejoining', async (req,res) => {
  const start = moment();
  const remainder = 30 - (start.minute() % 30);
  const dateTime = moment(start).add(remainder, "minutes");
  const today = moment()
    .format("YYYY-MM-DD")
    .toString();
  let slot = moment(dateTime).format("HH:mm");
  booking = await UserBooking.aggregate([
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
  let notifications = [];
  if (booking && booking.length > 0) {
    for (var i = 0; i < booking.length; i++) {
      let rec = {
        device_type: booking[i].device_type,
        device_token: booking[i].device_token,
        property_name: booking[i].property_name,
        id: booking[i].booking_id
      };
      tokens.push(rec);
      let notification = {
        title:"Booking Notification",
        description:"Your booking at " + booking[i].property_name + " in 30 minutes.",
        book_id:booking[i].booking_id,
        notification_type:'BOOKED',
        user_id:booking[i].user_id,
        booking_no:booking[i].booking_no
      }
      notifications.push(notification);
    }
  }

  for(var i=0;i<notifications.length;i++){
    let notification = new Notifications();
    let notification_child = new NotificationChild();
    notification.title = notifications[i].title;
    notification.description = notifications[i].description;
    notification.book_id = notifications[i].book_id;
    notification.booking_no = notifications[i].booking_no;
    notification.notification_type = notifications[i].notification_type;
    try{
      await notification.save();
      if(notification._id){
        notification_child.notification_id = notification._id;
        notification_child.user_id = notifications[i].user_id;
        await notification_child.save();
      }
    }catch(error){
      console.log(error);
    }    
  }

  // send_fcm(tokens);
  console.log({ status: "Before join" });
  return res.json({status:"true"});
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
router.get('/checkcron',async(req,res)=>{
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
        cancel_approval: 0
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
  console.log({booking});
  if (booking.length > 0) {
    console.log('hereee');
    for (var i = 0; i < booking.length; i++) {
      if (check_extended_booking_availability(booking[i]._id)){  
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
  return res.json({status:true});
})
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
          badge: 0
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
    console.log({token:regTokens[i].device_token,book_id:regTokens[i].id,notification_id:regTokens[i].notification_id})
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
          badge: 0
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
          book_id: regTokens[i].id
        }
      };
    }
    console.log({message});
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

router.get('/beforejoin',async(req,res)=>{
  const start = moment();
  const remainder = 30 - (start.minute() % 30);
  const dateTime = moment(start).add(remainder, "minutes");
  const today = moment().format("YYYY-MM-DD").toString();
  let slot = moment(dateTime).format("HH:mm");
  console.log({slot});
  booking = await UserBooking.aggregate([
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
  // return res.json({booking});
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
  return res.json({status:true})
});

router.get('/completed',async(req,res)=>{
  let bookings = await UserBooking.find({ date_checkout: { $lte: new Date() } })
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
    console.log('No bookings');
    // console.log({ status: "Success", message: "No Booking" });
  }
  return res.json({status:true});
})

router.get('/sendgeneralnotification',async(req,res)=>{
  let notification_id = req.query.notification_id;
  let tokens = [];
  if(notification_id){
    let notifications = await NotificationChild.find({notification_id:notification_id}).populate('user_id');
    if(notifications.length > 0){
      for(var i=0;i<notifications.length;i++){
        tokens.push({
          id: notifications[i].user_id.device_token,
          type: notifications[i].user_id.device_type,
          notification_id:notifications[i]._id
        })  
      }
    }
  }
  return res.json({status:true,tokens});  
});

module.exports = router;
