const db = require("../../../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const generator = require("generate-password");
const paginate = require("express-paginate");
const config = require("config");

const Property = require("../../../db/models/properties");
const Room = require("../../../db/models/rooms");
const HotelAdmin = require("../../../db/models/hoteladmins");
const User = require("../../../db/models/users");
const PropertyTypes = require("../../../db/models/propertytypes");
const PropertyRatings = require("../../../db/models/propertyratings");
const Countries = require("../../../db/models/countries");
const Currency = require("../../../db/models/currencies");
const City = require("../../../db/models/cities");
const UserBooking = require("../../../db/models/userbookings");

const path = require("path");
const _ = require("underscore");
const jwtMiddleware = require("../../../middleware/jwt");

const propertiesCrump = require("../../../middleware/propertiesCrump");
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
  let user = req.user;
  let {permissions} = user.role;
  const hasPropertiesAccess = permissions.indexOf(config.permissions.LIST_PROPERTIES) > -1;
  const hasAllPropertiesAccess = permissions.indexOf(config.permissions.LIST_ALL_PROPERTIES) > -1;
  const hasOwnPropertiesAccess = permissions.indexOf(config.permissions.LIST_OWN_PROPERTIES) > -1;
  if (!hasPropertiesAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }

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

  // Filter: User's properties - Restrict to logged in user viewing their own properties if they dont have access to all
  if (hasOwnPropertiesAccess && !hasAllPropertiesAccess) {
    where._id = {
      $in: user.properties
    }
  }

  // Filter: Keywords
  if (keyword) {
    where['$or'] = [
      {name: new RegExp(keyword, 'i')},
      {description: new RegExp(keyword, 'i')}
    ]
  }

  // Sorting
  let sort = { _id: 1 };
  if (req.query.order && req.query.orderBy) {
    sort = {};
    sort[req.query.orderBy] = req.query.order === 'asc' ? 1 : -1;
  }

  console.log('properties: where', where);
  const [hoteladmins, properties, itemCount] = await Promise.all([
    hasAllPropertiesAccess ? HotelAdmin.find() : Promise.resolve([]),
    Property
      .find(where)
      .sort(sort)
      .populate("company")
      .populate("rooms")
      .populate("type")
      .populate("rating")
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
    Property.countDocuments(where)
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
    list: properties,
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
