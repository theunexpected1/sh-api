const db = require("../../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const generator = require("generate-password");
const paginate = require("express-paginate");

const Property = require("../../db/models/properties");
const Room = require("../../db/models/rooms");
const HotelAdmin = require("../../db/models/hoteladmins");
const User = require("../../db/models/users");
const PropertyTypes = require("../../db/models/propertytypes");
const PropertyRatings = require("../../db/models/propertyratings");
const Countries = require("../../db/models/countries");
const Currency = require("../../db/models/currencies");
const City = require("../../db/models/cities");
const UserBooking = require("../../db/models/userbookings");

const path = require("path");
const _ = require("underscore");
const jwtMiddleware = require("../../middleware/jwt");

const propertiesCrump = require("../../middleware/propertiesCrump");
const { where } = require("underscore");

const createSchema = {
  name: joi
    .string()
    .min(3)
    .required(),
  type: joi
    .string()
    .min(8)
    .required(),
  rating: joi.string().required(),
  contact_person: joi.string().required(),
  legal_name: joi.string().required(),
  country: joi.string().required(),
  city: joi.string().required(),
  email: joi.string().required(),
  mobile: joi.string().required(),
  trade_licence_number: joi.string(),
  trade_licence_validity: joi.string()
};

const property_active_bookings = async property_id => {
  return await UserBooking.find({
    property: property_id
  }).count();
};

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), async (req, res) => {
  let active_page = 1;
  if(req.query.page){
    active_page = req.query.page;
  }
  let select_company = req.query.company;
  let keyword = req.query.q;
  let where = {};
  if (select_company) {
    where.company = select_company;
  }
  if (keyword) {
    where.name = new RegExp(keyword, 'i');
  }
  const [hoteladmins, properties, itemCount] = await Promise.all([
    HotelAdmin.find(),
    Property.find(where)
      .populate("company")
      .populate("type")
      .populate("rating")
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
    Property.find(where).count({})
  ]);
  try {
    for (var i = 0; i < properties.length; i++) {
      let rooms = await Room.aggregate([
        {
          $match: { property_id: db.Types.ObjectId(properties[i]._id) }
        },
        {
          $group: {
            _id: "$property_id",
            totalRooms: { $sum: "$number_rooms" }
          }
        },
        { $limit: 1 }
      ]);
      let total_rooms = 0;
      if (rooms.length > 0) {
        total_rooms = rooms[0].totalRooms;
      }
      properties[i].total_rooms = total_rooms;
    }
  } catch (error) {
    console.log(error);
  }
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    properties: properties,
    hoteladmins: hoteladmins,
    select_company: select_company,
    itemCount: itemCount,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    search: req.query.search,
    active_page
  };
  res.status(200).send(data).end();
});

module.exports = router;
