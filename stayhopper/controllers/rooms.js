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
const UserBooking = require('../db/models/userbookings');

const propertiesCrump = require("../middleware/propertiesCrump");
const propertiesCrump2 = require("../middleware/propertiesCrump2");

const createSchema = {
  property_id: joi.required(),
  room_type: joi.required(),
  number_rooms: joi.number().required(),
  room_name: joi.string().required(),
  bed_type: joi.string().required(),
  custom_name: joi
    .string()
    .allow("")
    .optional(),
  number_guests: joi.number().required(),
  number_beds: joi.number().required(),
  extrabed_option: joi.number().required(),
  extrabed_number: joi
    .number()
    .allow("")
    .optional(),
  amount_extrabed: joi
    .number()
    .allow("")
    .optional(),
  room_size: joi
    .string()
    .allow("")
    .optional(),
  extraslot_cleaning: joi
    .number()
    .allow("")
    .optional()
};

const updateSchema = {
  room_id: joi.required(),
  room_type: joi.required(),
  number_rooms: joi.number().required(),
  room_name: joi.string().required(),
  bed_type: joi.string().required(),
  custom_name: joi
    .string()
    .allow("")
    .optional(),
  number_guests: joi.number().required(),
  number_beds: joi.number().required(),
  extrabed_option: joi.number().required(),
  extrabed_number: joi
    .number()
    .allow("")
    .optional(),
  amount_extrabed: joi
    .number()
    .allow("")
    .optional(),
  room_size: joi
    .string()
    .allow("")
    .optional(),
  extraslot_cleaning: joi
    .number()
    .allow("")
    .optional()
};

router.get("/:id", propertiesCrump ,paginate.middleware(10, 50), async (req, res) => {
  let property_id = req.params.id;
  let property = await Property.findOne({ _id: property_id })
    .populate("company_id")
    .populate("type")
    .populate("rating");
  let where = { property_id: property_id };
  const [rooms, itemCount, totalRooms] = await Promise.all([
    Room.find(where)
      .populate("room_type")
      .populate("room_name")
      .populate("bed_type")
      .populate("services")
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
    Room.find(where).count({}),
    Room.aggregate([
      {
        $match: { property_id: db.Types.ObjectId(property_id) }
      },
      {
        $group: {
          _id: '$property_id',
          totalRooms: { $sum: "$number_rooms" }
        }
      },
      { $limit: 1 }
    ])
  ]);
  totalRoom = 0;
  if(totalRooms.length > 0){
    totalRoom = totalRooms[0].totalRooms;
  }
  // return res.json(totalRooms[0]);
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    property: property,
    rooms: rooms,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    pageCount: pageCount,
    itemCount: itemCount,
    search: req.query.search,
    totalRooms : totalRoom
  };
  // return res.json(data);
  res.render("rooms/list", data);
});

router.get("/edit/:id",propertiesCrump2,async (req, res) => {
  const data = ([
    bednumbers,
    bedtypes,
    guestnumbers,
    roomnames,
    roomtypes,
    services,
    room
  ] = await Promise.all([
    BedNumber.find().sort({name:1}),
    BedType.find().sort({name:1}),
    GuestNumber.find().sort({name:1}),
    RoomName.find().sort({name:1}),
    RoomType.find().sort({name:1}),
    Service.find().sort({name:1}),
    Room.findOne({ _id: req.params.id })
  ]));
  data.property = await Property.findOne({_id:room.property_id});
  // return res.json(data);
  data.id = req.params.id;
  res.render("rooms/edit", data);
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
    return res.status(200).json({ status: 0, errors: errors });
  }
  //update room
  let room = await Room.findOne({ _id: req.body.room_id });
  let data = req.body;
  room.room_type = data.room_type;
  room.number_rooms = data.number_rooms;
  room.room_name = data.room_name;
  room.bed_type = data.bed_type;
  room.custom_name = data.custom_name;
  room.number_guests = data.number_guests;
  room.number_beds = data.number_beds;
  room.extrabed_option = data.extrabed_option;
  if(room.extrabed_option == 0){
    room.extrabed_number = '';
    room.amount_extrabed = '';
  }else{
    room.extrabed_number = data.extrabed_number;
    room.amount_extrabed = data.amount_extrabed;
  }
  room.room_size = data.room_size;
  room.extraslot_cleaning = data.extraslot_cleaning;
  room.services = data.services;
  try {
    await room.save();
    return res.json({
      status: 1,
      message: "Room details updated successfully!"
    });
  } catch (error) {
    console.log(error);
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }
});

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
  let data = req.body;
  let property = await Property.findOne({_id:data.property_id});
  //save room
  let room = new Room();
  room.property_id = data.property_id;
  room.room_type = data.room_type;
  room.number_rooms = data.number_rooms;
  room.room_name = data.room_name;
  room.bed_type = data.bed_type;
  room.custom_name = data.custom_name;
  room.number_guests = data.number_guests;
  room.number_beds = data.number_beds;
  room.extrabed_option = data.extrabed_option;
  room.extrabed_number = data.extrabed_number;
  room.amount_extrabed = data.amount_extrabed;
  room.room_size = data.room_size;
  room.extraslot_cleaning = data.extraslot_cleaning;
  room.services = data.services;
  try {
    await room.save();
    property.rooms.push(room._id);
    await property.save();
    return res.json({ status: 1, message: "Room details saved successfully!" });
  } catch (error) {
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }
});

router.get("/new/:id", propertiesCrump,async (req, res) => {
  const [
    bednumbers,
    bedtypes,
    guestnumbers,
    roomnames,
    roomtypes,
    services,
    property
  ] = await Promise.all([
    BedNumber.find().sort({name:1}),
    BedType.find().sort({name:1}),
    GuestNumber.find().sort({name:1}),
    RoomName.find().sort({name:1}),
    RoomType.find().sort({name:1}),
    Service.find().sort({name:1}),
    Property.find({_id:req.params.id})
  ]);
  data = {
    bednumbers: bednumbers,
    bedtypes: bedtypes,
    guestnumbers: guestnumbers,
    roomnames: roomnames,
    roomtypes: roomtypes,
    services: services,
    id: req.params.id,
    property : property
  };
  res.render("rooms/new", data);
});

router.post('/delete',async(req,res)=>{
  let room = req.body.room;
  if(room){
    //check room is already used in booking
    let rooms = await UserBooking.find({'room.room':room});
    if(rooms.length >0){
      return res.json({status:0,message:"Room have active bookings, Could not delete now"});
    }else{
      let room_det = await Room.findOne({_id:room});
       await Room.deleteOne({_id:room});
       await Property.update({_id:room_det.property_id},{ $pull:{rooms:room_det._id}});
       return res.json({status:1,message:"Room deleted successfully"});
    }
  }
  return res.json({status:1,message:"Room deleted successfully"});
})
module.exports = router;
