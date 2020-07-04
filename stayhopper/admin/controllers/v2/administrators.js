// const db = require("../../../db/mongodb");
// const joi = require("joi");
// const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
// const multer = require("multer");
// const pify = require("pify");
// const generator = require("generate-password");
const paginate = require("express-paginate");
const config = require("config");

// const Property = require("../../../db/models/properties");
// const Room = require("../../../db/models/rooms");
// const HotelAdmin = require("../../../db/models/hoteladmins");
// const User = require("../../../db/models/users");
// const PropertyTypes = require("../../../db/models/propertytypes");
// const PropertyRatings = require("../../../db/models/propertyratings");
// const Countries = require("../../../db/models/countries");
// const Currency = require("../../../db/models/currencies");
// const City = require("../../../db/models/cities");
// const UserBooking = require("../../../db/models/userbookings");
// const path = require("path");
// const _ = require("underscore");
// const { where } = require("underscore");

const Administrator = require("../../../db/models/administrators");
const jwtMiddleware = require("../../../middleware/jwt");

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), async (req, res) => {
  let user = req.user;
  let {permissions} = user.role;
  const hasAdministratorsAccess = permissions.indexOf(config.permissions.LIST_ADMINISTRATORS) > -1;
  if (!hasAdministratorsAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }

  let active_page = 1;
  if(req.query.page){
    active_page = req.query.page;
  }
  let keyword = req.query.q;
  let where = {};

  // // Filter: User's properties - Restrict to logged in user viewing their own properties if they dont have access to all
  // if (hasOwnPropertiesAccess && !hasAllPropertiesAccess) {
  //   where._id = {
  //     $in: user.properties
  //   }
  // }

  // Filter: Keywords
  if (keyword) {
    where['$or'] = [
      {name: new RegExp(keyword, 'i')},
      {email: new RegExp(keyword, 'i')},
      {legal_name: new RegExp(keyword, 'i')}
    ]
  }

  console.log('where', where);

  // Sorting
  let sort = { _id: 1 };
  if (req.query.order && req.query.orderBy) {
    sort = {};
    sort[req.query.orderBy] = req.query.order === 'asc' ? 1 : -1;
  }

  const [administrators, itemCount] = await Promise.all([
    Administrator
      .find(where)
      .select('+email')
      .sort(sort)
      .populate("role")
      .populate("properties")
      .populate("country")
      .populate("city")
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
      Administrator.find(where).count({})
  ]);
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    administrators: administrators,
    itemCount: itemCount,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    active_page
  };
  res.status(200).send(data).end();
});

module.exports = router;
