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

const Country = require("../../../db/models/countries");
const City = require("../../../db/models/cities");
const Role = require("../../../db/models/roles");
const Property = require("../../../db/models/properties");
const jwtMiddleware = require("../../../middleware/jwt");

const listLookup = (ModelClass, selections, populations) => async (req, res) => {
  let user = req.user;
  let active_page = 1;

  if (req.query.page) {
    active_page = req.query.page;
  }

  const where = {};

  if (ModelClass === City) {
    const country = req.query.country;
    if (country) {
      where.country = country;
    }
  }

  // Sorting
  let sort = { _id: 1 };
  if (req.query.order && req.query.orderBy) {
    sort = {};
    sort[req.query.orderBy] = req.query.order === 'asc' ? 1 : -1;
  }

  const [list, itemCount] = await Promise.all([
    ModelClass
      .find(where)
      .select(selections || '')
      .populate(populations || '')
      .sort(sort)
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
    ModelClass.countDocuments(where)
  ]);

  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    list: list,
    itemCount: itemCount,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    active_page
  };
  res.status(200).send(data).end();
};

const countryPopulations = '';
const countrySelections = '_id country'

const cityPopulations = '';
const citySelections = '_id name country'

const propertySelections = '_id name rooms';

router.get("/countries", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), listLookup(Country, countrySelections, countryPopulations));
router.get("/cities", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), listLookup(City, citySelections, cityPopulations));
router.get("/roles", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), listLookup(Role));
router.get("/properties", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), listLookup(Property, propertySelections));

module.exports = router;
