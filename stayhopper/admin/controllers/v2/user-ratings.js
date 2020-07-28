const db = require("../../../db/mongodb");
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

const UserRating = require("../../../db/models/userratings");
const UserBooking = require("../../../db/models/userbookings");
const Property = require("../../../db/models/properties");
const CompletedBooking = require("../../../db/models/completedbookings");
const jwtMiddleware = require("../../../middleware/jwt");

const resourcePopulations = [
  {
    path: 'property',
    select: 'name'
  },
  {
    path: 'user'
  }
];

const updatePropertyRating = async (userRating) => {
  if (userRating._id) {
    try {
      let property = await Property.findOne({ _id: userRating.property._id });
      let ratings = await UserRating.aggregate([
        {
          $match: {
            property: db.Types.ObjectId(userRating.property._id)
          }
        },
        {
          $match: {
            approved: {
              $eq:true
            }
          }
        },
        {
          $group: {
            _id: null,
            count: {
              $sum: 1
            },
            value: {
              $sum: "$value"
            }
          }
        }
      ]);

      if (ratings.length > 0) {
        let userrating = ratings[0].value / ratings[0].count;
        var number = userrating;
        var rounded = Math.round(number * 10) / 10;
        property.user_rating = rounded;
      } else {
        property.user_rating = 0;
      }
      await property.save();
    } catch (e) {
      console.log('error in updating property ratings', e);
    }
  }
}

const list = async (req, res) => {
  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_USER_RATINGS) > -1;
  const hasPropertiesAccess = permissions.indexOf(config.permissions.LIST_ALL_PROPERTIES) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }

  let active_page = 1;
  // let keyword = req.query.q;
  let property = req.query.property;
  let approved = req.query.approved;
  let where = {};

  if(req.query.page){
    active_page = req.query.page;
  }

  // Filter Property
  if (property) {
    where.property = property;
  }

  // Filter Approval status
  if (approved !== '') {
    where.approved = approved;
  }

  // Sorting
  let sort = { _id: 1 };
  if (req.query.order && req.query.orderBy) {
    sort = {};
    sort[req.query.orderBy] = req.query.order === 'asc' ? 1 : -1;
  }

  let userRatings = await UserRating.find(where).sort(sort).populate(resourcePopulations).exec()
  if (req.query.orderBy === 'property') {
    const isAsc = req.query.order === 'asc';
    userRatings = userRatings
      .sort((a, b) => {
        if (a.property.name.trim().toLowerCase() < b.property.name.trim().toLowerCase()) { return isAsc ? -1 : 1; }
        if (a.property.name.trim().toLowerCase() > b.property.name.trim().toLowerCase()) { return isAsc ? 1 : -1; }
        return 0;
      })
      .splice(req.skip, req.query.limit)
    ;
  } else {
    userRatings = userRatings
      .splice(req.skip, req.query.limit)
    ;
  }

  /**
   Manual sorting as we cannot traditionally sort by property.name
   UserRating
    .find(where)
    .sort(sort)
    .populate(resourcePopulations)
    .limit(req.query.limit)
    .skip(req.skip)
    .lean()
    .exec()
  ;
  */

  let [properties, list, itemCount] = await Promise.all([
    hasPropertiesAccess ? Property.find({}).sort({name: 1}).select('_id name') : Promise.resolve([]),
    Promise.resolve(userRatings),
    UserRating.countDocuments(where)
  ]);

  const pageCount = Math.ceil(itemCount / req.query.limit);

  let data = {
    list: list,
    itemCount: itemCount,
    properties: properties,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    active_page
  };
  res.status(200).send(data).end();
};

// Approval (approve / unapprove)
// {id}/approve/true or {id}/approve/false
const approval = async (req, res) => {
  const user = req.user;
  const {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_USER_RATINGS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }
  
  try {
    let where = {
      _id: req.params.id
    };
  
    // Return updated doc
    let resource = await UserRating
      .findOneAndUpdate(where, { $set: {
        approved: req.params.status
      } }, { new: true })
      .populate(resourcePopulations)
      .exec()
    ;

    if (resource) {
      await updatePropertyRating(resource);
      res.status(200).send(resource).end();
    } else {
      res.status(404).send({
        message: 'Sorry, resource does not exist'
      }).end();
    }
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation'
    }).end();
  }
};

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), list);
router.put("/:id/approval/:status", jwtMiddleware.administratorAuthenticationRequired, approval);

module.exports = router;
