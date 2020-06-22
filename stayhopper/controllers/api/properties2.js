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

const _ = require("underscore");
const moment = require("moment");
const geodist = require("geodist");

const checkRoom = async (property, room, requested_slots) => {
  let available_rooms = [];
  for (var i = 0; i < requested_slots.length; i++) {
    let booking_det = await Booking.findOne({
      room: room,
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
      let room_det = await Room.findOne({ _id: room });
      for (var j = 1; j <= room_det.number_rooms; j++) {
        number_rooms_available.push(j);
      }
    }
    available_rooms.push(number_rooms_available);
  }
  let result_rooms = [];
  if (available_rooms.length > 0) {
    if (available_rooms[0].length > 0) {
      result_rooms = available_rooms[0];
    }
    if (
      typeof available_rooms[1] != "undefined") {
      result_rooms = _.intersection(available_rooms[1], result_rooms);
    }
    if (typeof available_rooms[2] != "undefined") {
      result_rooms = _.intersection(available_rooms[2], result_rooms);
    }
  }
  return result_rooms;
};

//1. Search =========================================================================
router.post("/search", async (req, res) => {
  let lat = 0;
  let lng = 0;
  let city = req.body.city;
  let sort_rating = -1;
  let filter_distance = 4000;
  let number_rooms = req.body.number_rooms;
  let service = req.body.service;
  let selected_hours = req.body.selected_hours;
  let filter_rating = req.body.rating;
  let filter_price = req.body.price;
  let checkin_time = req.body.checkin_time;
  let checkin_date = req.body.checkin_date;
  let tmp_date = new Date(checkin_date);
  let requested_slots = [];

  let checkin_date2 = moment(tmp_date)
    .add(1, "days")
    .format("YYYY-MM-DD");
  let checkin_date3 = moment(tmp_date)
    .add(2, "days")
    .format("YYYY-MM-DD");

  let requested_slot = await Slot.findOne({ label: checkin_time });
  let tot_no_slots = selected_hours * 2;
  if (requested_slot) {
    from = parseInt(requested_slot.no) - 1;
    to = tot_no_slots;
  }
  let requested_slots_day1 = await Slot.find()
    .select("_id")
    .skip(from)
    .limit(tot_no_slots);
  let requested_slots_day2 = [];
  let requested_slots_day3 = [];
  if (requested_slots_day1.length < tot_no_slots) {
    let balance_slots = tot_no_slots - requested_slots_day1.length;
    requested_slots_day2 = await Slot.find()
      .select("_id")
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

  let last_requested_slot = requested_slots[requested_slots.length - 1];
  let last_slot =
    last_requested_slot.slots[last_requested_slot.slots.length - 1];
  last_requested_slot = await Slot.findOne({
    _id: db.Types.ObjectId(last_slot)
  });
  let last_no = last_requested_slot.no;
  last_slot = requested_slots[requested_slots.length - 1];

  if (filter_price) {
    filter_price = filter_price.split(",");
  }

  if (req.body.location) {
    let tmp_loc = req.body.location.split(",");
    lat = tmp_loc[0];
    lng = tmp_loc[1];
  }
  let filter = {};
  room_filter = {};
  if (service) {
    room_filter["services"] = db.Types.ObjectId(service);
  }
  filter.approved = true;
  filter.timeslots = selected_hours;
  filter.rooms = { $exists: true, $ne: [] };
  let rating_filter = {};
  if (filter_rating) {
    rating_filter._id = db.Types.ObjectId(filter_rating);
  }
  if (city) {
    filter["contactinfo.city"] = db.Types.ObjectId(city);
  } else {
    filter.location = {
      $near: {
        $maxDistance: filter_distance,
        $geometry: {
          type: "Point",
          coordinates: [lng, lat]
        }
      }
    };
  }
  if (filter_price) {
    if (filter_price.length > 0) {
      let low_price = parseInt(filter_price[0]);
      let high_price = parseInt(filter_price[1]);
      switch (selected_hours) {
        case "3":
          room_filter["price.h3"] = { $gte: low_price, $lte: high_price };
          break;
        case "6":
          room_filter["price.h6"] = { $gte: low_price, $lte: high_price };
          break;
        case "12":
          room_filter["price.h12"] = { $gte: low_price, $lte: high_price };
          break;
        case "24":
          room_filter["price.h24"] = { $gte: low_price, $lte: high_price };
          break;
      }
    }
  }
  try {
    let properties = await Property.find(filter)
      .populate({
        path: "rooms",
        match: room_filter,
        populate: [
          { path: "services" },
          { path: "bed_type" },
          { path: "room_name" },
          { path: "room_type" }
        ]
      })
      .populate({ path: "type" })
      .populate({ path: "rating", match: rating_filter })
      .populate({ path: "policies" })
      .populate({ path: "terms" })
      .populate({ path: "contactinfo.country" })
      .populate({ path: "contactinfo.city" })
      .populate({ path: "payment.country" })
      .populate({ path: "payment.currency" })
      // .sort({ "rating.value": sort_rating })
      // .lean()
      // .exec();
    if (properties.length > 0) {
      for (var i = 0; i < properties.length; i++) {
        if (!properties[i].rating) {
          properties.splice(i, 1);
          i = i - 1;
          continue;
        }
        if (properties[i].rooms.length < 1) {
          properties.splice(i, 1);
          i = i - 1;
          continue;
        } else {
          properties[i].total_available_rooms = 0;
          for (var j = 0; j < properties[i].rooms.length; j++) {
            let custom_price = await Price.findOne({
              $and: [
                { room: properties[i].rooms[j]._id },
                { from: { $lte: new Date(checkin_date) } },
                { to: { $gte: new Date(checkin_date) } }
              ]
            }).sort({ _id: -1 });
            if (custom_price) {
              if (filter_price) {
                let low_price = parseInt(filter_price[0]);
                let high_price = parseInt(filter_price[1]);
                switch (selected_hours) {
                  case "3":
                    if (
                      !(custom_price.h3 >= low_price) ||
                      !(custom_price.h3 <= high_price)
                    ) {
                      properties[i].rooms.splice(j, 1);
                      j = j - 1;
                      continue;
                    }
                    break;
                  case "6":
                    if (
                      !(custom_price.h6 >= low_price) ||
                      !(custom_price.h6 <= high_price)
                    ) {
                      properties[i].rooms.splice(j, 1);
                      j = j - 1;
                      continue;
                    }
                    break;
                  case "12":
                    if (
                      !(custom_price.h12 >= low_price) ||
                      !(custom_price.h12 <= high_price)
                    ) {
                      properties[i].rooms.splice(j, 1);
                      j = j - 1;
                      continue;
                    }
                    break;
                  case "24":
                    if (
                      !(custom_price.h24 >= low_price) ||
                      !(custom_price.h24 <= high_price)
                    ) {
                      properties[i].rooms.splice(j, 1);
                      j = j - 1;
                      continue;
                    }
                    break;
                }
              }
              properties[i].rooms[j].custom_price = custom_price;
            }
            let extraslot_cleaning = properties[i].rooms[j].extraslot_cleaning;
            if (extraslot_cleaning) {
              extraslot_cleaning = parseInt(extraslot_cleaning) + 1;
            } else {
              extraslot_cleaning = 1;
            }

            let extraslot = await Slot.find()
              .select("_id")
              .skip(parseInt(last_no))
              .limit(extraslot_cleaning);
            for (var l = 0; l < extraslot.length; l++) {
              last_slot.slots.push(extraslot[l]._id.toString());
            }
            let extraslot2 = [];
            if (extraslot.length < extraslot_cleaning) {
              extraslot2 = await Slot.find()
                .select("_id")
                .limit(extraslot_cleaning - extraslot.length);
              let tmp_slot = {};
              let tmp_slots = [];
              tmp_slot.day = last_slot.day + 1;
              tmp_slot.date = moment(new Date(last_slot.date))
                .add(1, "days")
                .format("YYYY-MM-DD");
              for (var l = 0; l < extraslot2.length; l++) {
                tmp_slots.push(extraslot2[l]._id.toString());
              }
              tmp_slot.slots = tmp_slots;
              requested_slots.push(tmp_slot);
            }

            let available_rooms = await checkRoom(
              properties[i]._id,
              properties[i].rooms[j]._id,
              requested_slots
            );
            let ind = last_slot.slots.length - extraslot.length;
            last_slot.slots.splice(ind, extraslot.length);
            if (extraslot2.length > 0) {
              requested_slots.splice(requested_slots.length - 1, 1);
            }
            if (available_rooms.length > 0) {
              properties[i].rooms[j].free_rooms = available_rooms.length;
              properties[i].total_available_rooms += available_rooms.length;
            } else {
              properties[i].rooms.splice(j, 1);
              j = j - 1;
              continue;
            }
          }
          if (properties[i].total_available_rooms < number_rooms) {
            // console.log(properties[i]);
            properties.splice(i, 1);
            i = i - 1;
            continue;
          }
        }
      }
      if (properties.length > 0) {
        return res.json({ status: "Success", data: properties });
      } else {
        return res.json({ status: "Failed", message: "No data" });
      }
    } else {
      return res.json({ status: "Failed", message: "No data" });
    }
  } catch (error) {
    console.log(error);
    return res.json({ status: "Failed", message: "No data" });
  }
});

//2. Search/near =========================================================================
router.get("/search/near", async (req, res) => {
  let lat = 0;
  let lng = 0;
  let city = req.query.city;
  let sort_rating = -1;
  let filter_distance = 4000;
  let service = req.query.service;
  let filter_price = req.query.price;
  let filter_rating = req.query.rating;
  let checkin_time = req.query.checkin_time;
  let tmp_date = new Date();
  let requested_slots = [];
  let selected_hours = 3;

  let checkin_date = moment(tmp_date).format("YYYY-MM-DD");
  let checkin_date2 = moment(tmp_date)
    .add(1, "days")
    .format("YYYY-MM-DD");

  let requested_slot = await Slot.findOne({ label: checkin_time });
  let tot_no_slots = selected_hours * 2;
  if (requested_slot) {
    from = parseInt(requested_slot.no) - 1;
    to = tot_no_slots;
  }

  let requested_slots_day1 = await Slot.find()
    .select("_id")
    .skip(from)
    .limit(tot_no_slots);

  let requested_slots_day2 = [];
  if (parseInt(requested_slots_day1.length) < tot_no_slots) {
    let balance_slots = tot_no_slots - requested_slots_day1.length;
    requested_slots_day2 = await Slot.find()
      .select("_id")
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

  let last_requested_slot = requested_slots[requested_slots.length - 1];
  let last_slot =
    last_requested_slot.slots[last_requested_slot.slots.length - 1];
  last_requested_slot = await Slot.findOne({
    _id: db.Types.ObjectId(last_slot)
  });

  if (filter_price) {
    filter_price = filter_price.split(",");
  }
  if (req.query.location) {
    let tmp_loc = req.query.location.split(",");
    lat = tmp_loc[0];
    lng = tmp_loc[1];
  }
  let filter = {};
  let room_filter = {};
  if (service) {
    room_filter["services"] = db.Types.ObjectId(service);
  }
  let rating_filter = {};
  if (filter_rating) {
    rating_filter._id = db.Types.ObjectId(filter_rating);
  }
  filter.approved = true;
  filter.rooms = { $exists: true, $ne: [] };
  filter["timeslots"] = selected_hours;
  if (city) {
    filter["contactinfo.city"] = db.Types.ObjectId(city);
  } else {
    filter.location = {
      $near: {
        $maxDistance: filter_distance,
        $geometry: {
          type: "Point",
          coordinates: [lng, lat]
        }
      }
    };
  }
  if (filter_price) {
    let low_price = parseInt(filter_price[0]);
    let high_price = parseInt(filter_price[1]);
    room_filter["$and"] = [
      {
        $or: [
          { "price.h3": { $gte: low_price, $lte: high_price } },
          { "price.h6": { $gte: low_price, $lte: high_price } },
          { "price.h12": { $gte: low_price, $lte: high_price } },
          { "price.h24": { $gte: low_price, $lte: high_price } }
        ]
      }
    ];
  }
  let properties = [];
  try {
    properties = await Property.find(filter)
      .populate({
        path: "rooms",
        match: room_filter,
        populate: [
          { path: "services" },
          { path: "bed_type" },
          { path: "room_name" },
          { path: "room_type" }
        ]
      })
      .populate({ path: "type" })
      .populate({ path: "rating", match: rating_filter })
      .populate({ path: "policies" })
      .populate({ path: "terms" })
      .populate({ path: "contactinfo.country" })
      .populate({ path: "contactinfo.city" })
      .populate({ path: "payment.country" })
      .populate({ path: "payment.currency" })
      .sort({ "rating.value": sort_rating })
      .lean()
      .exec();
    if (properties.length > 0) {
      for (var i = 0; i < properties.length; i++) {
        let property_loc = properties[i].contactinfo.latlng;
        let current_loc = {
          lat: lat,
          lng: lng
        };
        if (properties[i].rooms.length < 1) {
          properties.splice(i, 1);
          i = i - 1;
          continue;
        }
        properties[i].distance = get_distance(property_loc, current_loc);
        properties[i].distance_unit = "Kms";
      }
      if (properties.length > 0) {
        for (j = 0; j < properties.length; j++) {
          for (k = 0; k < properties[j].rooms.length; k++) {
            let custom_price = await Price.findOne({
              $and: [
                { room: properties[j].rooms[k]._id },
                { from: { $lte: new Date() } },
                { to: { $gte: new Date() } }
              ]
            }).sort({ _id: -1 });
            if (custom_price) {
              properties[j].rooms[k].custom_price = custom_price;
            }
            let extraslot_cleaning = 0;
            extraslot_cleaning = properties[j].rooms[k].extraslot_cleaning;
            if (!extraslot_cleaning) {
              extraslot_cleaning = 1;
            } else {
              extraslot_cleaning += 1;
            }
            let extraslots = [];
            if (extraslot_cleaning) {
              let extra_slot = {
                day: requested_slots[requested_slots.length - 1].day,
                date: requested_slots[requested_slots.length - 1].date,
                slots: requested_slots[requested_slots.length - 1].slots
              };
              extra_slot.slots = [];
              let extra_slots_det = await Slot.find()
                .select("_id")
                .skip(parseInt(last_requested_slot.no))
                .limit(extraslot_cleaning);
              for (var l = 0; l < extra_slots_det.length; l++) {
                extra_slot.slots.push(extra_slots_det[l]._id.toString());
              }
              extraslots.push(extra_slot);
              if (extra_slot.slots.length < extraslot_cleaning) {
                let balence_slot = extraslot_cleaning - extra_slot.slots.length;
                let extraslot_day = extra_slot.day + 1;
                let extraslot_date2 = moment(new Date(extra_slot.date))
                  .add(1, "days")
                  .format("YYYY-MM-DD");
                let extra_slots_det = await Slot.find()
                  .select("_id")
                  .limit(extraslot_cleaning);
                let slots = [];
                for (var l = 0; l < extra_slots_det.length; l++) {
                  slots.push(extra_slots_det[l]._id);
                }
                extraslots.push({
                  day: extraslot_day,
                  date: extraslot_date2,
                  slots: slots
                });
              }
            }
            requested_slots.push(extraslots[0]);
            if (typeof extraslots[1] != "undefined") {
              requested_slots.push(extraslots[1]);
            }
            let available_rooms = await checkRoom(
              properties[j]._id,
              properties[j].rooms[k]._id,
              requested_slots
            );
            requested_slots.splice(
              requested_slots.length - 1,
              extraslots.length
            );
            // console.log(requested_slots);
            if (available_rooms.length > 0) {
              properties[j].rooms[k].free_rooms = available_rooms.length;
              properties[j].total_available_rooms += available_rooms.length;
            } else {
              properties[j].rooms.splice(k, 1);
              k = k - 1;
              continue;
            }
          }
          if (properties[j].rooms.length < 1) {
            properties.splice(j, 1);
            j = j - 1;
          }
        }
        return res.json({ status: "Success", data: properties });
      } else {
        return res.json({ status: "Failed", message: "No data" });
      }
    } else {
      return res.json({ status: "Failed", message: "No data" });
    }
  } catch (error) {
    console.log(error);
    return res.json({ status: "Failed", message: "No data" });
  }
});

router.get("/cities", async (req, res) => {
  let cities = await City.find({})
    .lean()
    .exec();
  if (cities) {
    for (var i = 0; i < cities.length; i++) {
      cities[i].property_count = await Property.find({
        "contactinfo.city": cities[i]._id
      }).count();
    }
    return res.json({ status: "Success", data: cities });
  } else {
    return res.json({ status: "Failed", message: "No data" });
  }
});

const get_distance = (property_loc, current_loc) => {
  let dist = geodist(property_loc, current_loc, { exact: true, unit: "km" });
  return dist;
};

//4. Single =========================================================================
router.get("/single", async (req, res) => {
  let from = 0;
  let to = 0;
  let property_id = req.query.property;
  let number_rooms = req.query.number_rooms;
  let service = req.query.service;
  let selected_hours = req.query.selected_hours;
  let checkin_time = req.query.checkin_time;
  let checkin_date = req.query.checkin_date;
  let tmp_date = new Date(checkin_date);
  let requested_slots = [];
  let lat = 0;
  let lng = 0;
  if (req.query.location) {
    let tmp_loc = req.query.location.split(",");
    lat = tmp_loc[0];
    lng = tmp_loc[1];
  }

  let checkin_date2 = moment(tmp_date)
    .add(1, "days")
    .format("YYYY-MM-DD");
  let checkin_date3 = moment(tmp_date)
    .add(2, "days")
    .format("YYYY-MM-DD");
  let requested_slot = await Slot.findOne({ label: checkin_time });
  let tot_no_slots = selected_hours * 2;
  if (requested_slot) {
    from = parseInt(requested_slot.no) - 1;
    to = tot_no_slots;
  }
  let requested_slots_day1 = await Slot.find()
    .select("_id")
    .skip(from)
    .limit(tot_no_slots);
  let requested_slots_day2 = [];
  let requested_slots_day3 = [];
  if (requested_slots_day1.length < tot_no_slots) {
    let balance_slots = tot_no_slots - requested_slots_day1.length;
    requested_slots_day2 = await Slot.find()
      .select("_id")
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
  room_filter = {};
  if (service) {
    room_filter["services"] = db.Types.ObjectId(service);
  }
  let filter = {};
  filter._id = property_id;
  filter.approved = true;
  filter.rooms = { $exists: true, $ne: [] };
  let properties = {};
  try {
    properties = await Property.findOne(filter)
      .populate({
        path: "rooms",
        match: room_filter,
        populate: [
          { path: "services" },
          { path: "bed_type" },
          { path: "room_name" },
          { path: "room_type" }
        ]
      })
      .populate({ path: "type" })
      .populate({ path: "rating" })
      .populate({ path: "policies" })
      .populate({ path: "terms" })
      .populate({ path: "contactinfo.country" })
      .populate({ path: "contactinfo.city" })
      .populate({ path: "payment.country" })
      .populate({ path: "payment.currency" })
      .lean()
      .exec();
    if (properties) {
      let property_loc = properties.contactinfo.latlng;
      let current_loc = {
        lat: lat,
        lng: lng
      };
      properties.distance = get_distance(property_loc, current_loc);
      properties.distance_unit = "Kms";
      properties.total_available_rooms = 0;
      for (var j = 0; j < properties.rooms.length; j++) {
        let custom_price = await Price.findOne({
          $and: [
            { room: properties.rooms[j]._id },
            { from: { $lte: new Date(checkin_date) } },
            { to: { $gte: new Date(checkin_date) } }
          ]
        }).sort({ _id: -1 });
        if (custom_price) {
          properties.rooms[j].custom_price = custom_price;
        }
        let extraslot_cleaning = properties.rooms[j].extraslot_cleaning;
        if (extraslot_cleaning) {
          requested_slot =
            requested_slots[requested_slots.length - 1].slots[
              requested_slots[requested_slots.length - 1].slots.length - 1
            ];
          requested_slot = await Slot.findOne({
            _id: db.Types.ObjectId(requested_slot)
          });
          tot_no_slots = extraslot_cleaning + 1;
          if (requested_slot) {
            from = parseInt(requested_slot.no);
            to = tot_no_slots;
          }
          let extra_slots = await Slot.find()
            .select("_id")
            .skip(from)
            .limit(tot_no_slots);
          for (var k = 0; k < extra_slots.length; k++) {
            requested_slots[requested_slots.length - 1].slots.push(
              extra_slots[k]._id
            );
          }
          if (extra_slots.length < tot_no_slots) {
            extra_slots = await Slot.find()
              .select("_id")
              .limit(tot_no_slots - extra_slots.length);
            let requested_slot = {};
            requested_slot.day =
              requested_slots[requested_slots.length - 1].day + 1;
            requested_slot.date = moment(
              requested_slots[requested_slots.length - 1].date
            )
              .add(1, "days")
              .format("YYYY-MM-DD");
            requested_slot.slots = [];
            for (var k = 0; k < extra_slots.length; k++) {
              requested_slot.slots.push(extra_slots[k]._id);
            }
            requested_slots.push(requested_slot);
          }
        }
        let available_rooms = await checkRoom(
          properties._id,
          properties.rooms[j]._id,
          requested_slots
        );
        if (available_rooms.length > 0) {
          properties.rooms[j].free_rooms = available_rooms.length;
          properties.total_available_rooms += available_rooms.length;
        } else {
          properties.rooms.splice(j, 1);
          j = j - 1;
          continue;
        }
      }
      if (properties.rooms.length > 0) {
        let userratings = await UserRating.find({property:properties._id}).populate('user');
        properties.reviews = userratings;
        return res.json({ status: "Success", data: properties });
      } else {
        return res.json({ status: "Failed", message: "No data" });
      }
    } else {
      return res.json({ status: "Failed", message: "No data" });
    }
  } catch (error) {
    console.log(error);
    return res.json({ status: "Failed", message: "No data" });
  }
});

router.get("/:id/details", async (req, res) => {
  let property = await Property.findOne({ _id: req.params.id }).populate({
    path: "rooms",
    populate: [
      { path: "services" },
      { path: "room_name" },
      { path: "bed_type" }
    ]
  });
  if (property) {
    return res.json({ status: "Success", data: property });
  } else {
    return res.json({ status: "Failed", message: "No data" });
  }
});

router.get("/popular", async (req, res) => {
  let lat = 0;
  let lng = 0;
  let filter_distance = 4000;
  let filter = {
    approved: true
  };
  if (req.query.location) {
    let tmp_loc = req.query.location.split(",");
    lat = tmp_loc[0];
    lng = tmp_loc[1];
    filter.location = {
      $near: {
        $maxDistance: filter_distance,
        $geometry: {
          type: "Point",
          coordinates: [lng, lat]
        }
      }
    };
  }

  // properties = await Property.aggregate([
  //   {
  //     $lookup: {
  //       from: "rooms",
  //       localField: "_id",
  //       foreignField: "property_id",
  //       as: "rooms"
  //     }
  //   },
  //   {
  //     $match: {
  //       "contactinfo.latlng": {
  //         $geoWithin: {
  //           $centerSphere: [[parseInt(lat), parseInt(lng)], 40 / 3963.2]
  //         }
  //       }
  //     }
  //   },
  //   { $sort: { user_rating: -1 } }
  // ]);
  let properties = await Property.find(filter).populate({
    path: "rooms",
    populate: [
      { path: "services" },
      { path: "bed_type" },
      { path: "room_name" },
      { path: "room_type" }
    ]
  })
  .populate({ path: "type" })
  .populate({ path: "rating"})
  .populate({ path: "policies" })
  .populate({ path: "terms" })
  .populate({ path: "contactinfo.country" })
  .populate({ path: "contactinfo.city" })
  .populate({ path: "payment.country" })
  .populate({ path: "payment.currency" })
  .sort({user_rating: -1});

  if (properties && properties.length > 0) {
    return res.json({ status: "Success", data: properties });
  } else {
    return res.json({ status: "Failed", message: "No data!" });
  }
});

router.get("/homedata", async (req, res) => {
  let lat = 0;
  let lng = 0;
  let filter = {
    approved: true
  };
  let filter_distance = 4000;
  if (req.query.location) {
    let tmp_loc = req.query.location.split(",");
    lat = tmp_loc[0];
    lng = tmp_loc[1];
    filter.location = {
      $near: {
        $maxDistance: filter_distance,
        $geometry: {
          type: "Point",
          coordinates: [lng, lat]
        }
      }
    };
  }
  let result = {};
  //cities
  let cities = await City.find()
    .lean()
    .exec();
  if (cities) {
    for (var i = 0; i < cities.length; i++) {
      cities[i].property_count = await Property.find({
        "contactinfo.city": cities[i]._id
      }).count();
    }
    result.cities = cities;
  } else {
    result.cities = [];
  }
  //end cities
  //popular
  let properties = await Property.find(filter).populate({
    path: "rooms",
    populate: [
      { path: "services" },
      { path: "bed_type" },
      { path: "room_name" },
      { path: "room_type" }
    ]
  })
  .populate({ path: "type" })
  .populate({ path: "rating"})
  .populate({ path: "policies" })
  .populate({ path: "terms" })
  .populate({ path: "contactinfo.country" })
  .populate({ path: "contactinfo.city" })
  .populate({ path: "payment.country" })
  .populate({ path: "payment.currency" })
  .sort({user_rating: -1});

  if (properties && properties.length > 0) {
    result.popular = properties;
  } else {
    result.popular = [];
  }
  //end popular
  //start nearby
  let nearby = await Property.find(filter).populate({
    path: "rooms",
    populate: [
      { path: "services" },
      { path: "bed_type" },
      { path: "room_name" },
      { path: "room_type" }
    ]
  })
  .populate({ path: "type" })
  .populate({ path: "rating"})
  .populate({ path: "policies" })
  .populate({ path: "terms" })
  .populate({ path: "contactinfo.country" })
  .populate({ path: "contactinfo.city" })
  .populate({ path: "payment.country" })
  .populate({ path: "payment.currency" })
  .sort({user_rating: -1});

  let available_properties = [];
  for (i = 0; i < nearby.length; i++) {
    let rooms = nearby[i].rooms;
    let available_rooms = 0;
    if (rooms) {
      if (nearby[i].approved != false) {
        available_properties.push(nearby[i]);
      }
    }
  }
  if (available_properties && available_properties.length > 0) {
    result.nearby = nearby;
  } else {
    result.nearby = [];
  }
  //end nearby
  res.json({ status: "Success", data: result });
});

module.exports = router;
