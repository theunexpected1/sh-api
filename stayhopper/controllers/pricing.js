const db = require("../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const generator = require("generate-password");
const path = require("path");
const paginate = require("express-paginate");

const Property = require("../db/models/properties");
const BedNumber = require("../db/models/bednumbers");
const BedType = require("../db/models/bedtypes");
const GuestNumber = require("../db/models/guestnumbers");
const RoomName = require("../db/models/roomnames");
const RoomType = require("../db/models/roomtypes");
const Service = require("../db/models/services");
const Room = require("../db/models/rooms");
const Price = require("../db/models/pricing");
const _ = require("underscore");
const moment = require("moment");

const propertiesCrump = require("../middleware/propertiesCrump");

const createSchema = {
  from: joi.required(),
  to: joi.required(),
  property: joi.required(),
  room: joi.string().required()
};

const updateSchema = {
  from: joi.required(),
  to: joi.required()
};

router.post("/", async (req, res) => {
  const valid = joi.validate(req.body, createSchema, {
    abortEarly: false,
    allowUnknown: true
  });
  var errors = [];
  if (valid.error) {
    errors = valid.error.details.map(error => {
      return error.message;
    });
  }
  if (errors.length > 0) {
    return res.status(200).json({ status: 0, errors: errors });
  }
  let price = new Price();
  price.from = req.body.from;
  price.to = req.body.to;
  price.property = req.body.property;
  price.room = req.body.room;

  let data = req.body;

  if (data.h3) {
    price.h3 = data.h3;
  }
  if (data.h6) {
    price.h6 = data.h6;
  }
  if (data.h12) {
    price.h12 = data.h12;
  }
  if (data.h24) {
    price.h24 = data.h24;
  }

  try {
    await price.save();
    return res.json({ status: 1, message: "Room details saved successfully!" });
  } catch (error) {
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }
});

router.post("/update", async (req, res) => {
  const valid = joi.validate(req.body, updateSchema, {
    abortEarly: false,
    allowUnknown: true
  });
  var errors = [];
  if (valid.error) {
    errors = valid.error.details.map(error => {
      return error.message;
    });
  }
  if (errors.length > 0) {
    return res.json({ status: 0, errors: errors });
  }
  let price = await Price.findOne({ _id: req.body.id });
  if (price) {
    price.from = req.body.from;
    price.to = req.body.to;

    let data = req.body;
    if (data.h3) {
      price.h3 = data.h3;
    }
    if (data.h6) {
      price.h6 = data.h6;
    }
    if (data.h12) {
      price.h12 = data.h12;
    }
    if (data.h24) {
      price.h24 = data.h24;
    }
    try {
      await price.save();
      return res.json({
        status: 1,
        message: "Room details updated successfully!"
      });
    } catch (error) {
      var errors = [];
      for (field in error.errors) {
        errors.push(error.errors[field].message);
      }
      return res.json({ status: 0, errors: errors });
    }
  } else {
    return res.json({
      status: 0,
      message: "Room details could not update!"
    });
  }
});

router.get("/:id", propertiesCrump, async (req, res) => {
  let property_id = req.params.id;
  let property = await Property.findOne({ _id: property_id });
  let rooms = await Room.find({ property_id: property_id })
    .populate("room_type")
    .populate("room_name")
    .lean()
    .exec();
  for(var i=0;i<rooms.length;i++){
    rooms[i].display_name = "";
    if(rooms[i].room_type){
      rooms[i].display_name = rooms[i].custom_name?rooms[i].custom_name:rooms[i].room_type.name;
    }
  };
  let data = {
    property: property,
    rooms: rooms
  };
  res.render("pricing/list", data);
});

router.get("/edit/:id", async (req, res) => {
  let room_id = req.params.id;
  let pricing = await Price.find({ room: room_id });
  let room = await Room.findOne({ _id: room_id })
  .populate("room_type")
  .populate("room_name")
  .lean()
  .exec();
  room.display_name = room.custom_name?room.custom_name:room.room_type.name;
  let timeslots = {};
  if (room) {
    let property = await Property.findOne({ _id: room.property_id });
    if (property) {
      timeslots = property.timeslots;
    }
  }
  let prices = {};
  if (room.price) {
    prices = room.price;
  }
  console.log(prices);
  let data = {
    pricing: pricing,
    room: room,
    property: property,
    timeslots: timeslots,
    prices: prices,
    moment: moment,
    _: _
  };
  // return res.json(room);
  res.render("pricing/innerlist", data);
});

router.get("/edit/price/:id", async (req, res) => {
  let price_id = req.params.id;
  price = await Price.findOne({ _id: price_id });
  let data = {
    price: price
  };
  // return res.json(data);
  res.render("pricing/edit", data);
});

router.get("/new/:id", async (req, res) => {
  let room = await Room.findOne({ _id: req.params.id });
  let data = {
    room: room
  };
  res.render("pricing/new", data);
});

router.get("/delete/:id", async (req, res) => {
  let pricing_id = req.params.id;
  let price = await Price.findOne({ _id: pricing_id });
  let room_id = price.room;
  await Price.deleteOne({ _id: pricing_id });
  res.redirect("/pricing/edit/" + room_id);
});

router.post("/defaultprice", async (req, res) => {
  let room_id = req.body.room_id;
  let data = req.body;
  // return res.json({status:0,data:slots});
  room = await Room.findOne({ _id: room_id });
  // let property = Property.findOne({_id:room.property_id});
  let price = {};
  if (room) {
    if (data.h3) {
      price.h3 = data.h3;
    }
    if (data.h6) {
      price.h6 = data.h6;
    }
    if (data.h12) {
      price.h12 = data.h12;
    }
    if (data.h24) {
      price.h24 = data.h24;
    }
    room.price = price;
    try {
      await room.save();
      res.json({ status: 1, message: "Default price updated successfully!" });
    } catch (error) {}
  } else {
    res.json({ status: 0, message: "Could not update default price" });
  }
});

router.post("/getPrice", async (req, res) => {
  let id = req.body.id;
  if (id) {
    data = await Price.findOne({ _id: id });
    if (data) {
      let from = moment(data.from).format("MM/DD/YYYY");
      let to = moment(data.to).format("MM/DD/YYYY");
      return res.json({ status: 1, data: data, from: from, to: to });
    } else {
      return res.json({ status: 0, message: "No data!" });
    }
  } else {
    return res.json({ status: 0, message: "No data!" });
  }
});

module.exports = router;
