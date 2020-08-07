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
const generator = require("generate-password");
const bcrypt = require('bcrypt');

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);

const fs = require('fs');
const util = require('util');
const path = require('path');
const readFile = util.promisify(fs.readFile);
const currentDirPath = path.resolve(__dirname);

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

const User = require("../../../db/models/users");
const UserBooking = require("../../../db/models/userbookings");
const Country = require("../../../db/models/countries");
const CompletedBooking = require("../../../db/models/completedbookings");
const jwtMiddleware = require("../../../middleware/jwt");

const resourcePopulations = [
  // {
  //   path: 'favourites'
  // }
];

const getExtraUserInformation = async (user) => {
  let sum1, sum2, countryId;
  let totalBookingAmt = 0;
  let totalBookingCount = 0;
  let totalCompletedBookingAmt = 0;
  let totalCompletedBookingCount = 0;

  sum1 = await UserBooking.aggregate([
    { $match: { user: user._id } },
    {
      $group: {
        _id: "$user",
        totalAmount: { $sum: "$total_amt" },
        count: { $sum: 1 }
      }
    }
  ]);
  sum2 = await CompletedBooking.aggregate([
    { $match: { user: user._id } },
    {
      $group: {
        _id: "$user",
        totalAmount: { $sum: "$total_amt" },
        count: { $sum: 1 }
      }
    }
  ]);

  const [bookings, completedBookings] = await Promise.all([
    UserBooking.find({user: user._id}),
    CompletedBooking.find({user: user._id})
  ])

  // Save Country information
  // countryId = await Country.findOne({country: user.country});
  // user.country_id = countryId;

  if (sum1.length>0) {
    totalBookingAmt = sum1[0].totalAmount;
    totalBookingCount = sum1[0].count;
  }
  if (sum2.length > 0) {
    totalCompletedBookingAmt = sum2[0].totalAmount;
    totalCompletedBookingCount = sum2[0].count;
  }

  // Save Booking information
  user.bookings = {
    amount: (totalBookingAmt || 0) + (totalCompletedBookingAmt || 0),
    count: (totalBookingCount || 0) + (totalCompletedBookingCount || 0),
    bookings,
    completedBookings
  }

  return user;
}


const list = async (req, res) => {
  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_USERS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }

  let countries = await Country.find({});
  let active_page = 1;
  let keyword = req.query.q;
  let country = req.query.country;
  let where = {};

  if(req.query.page){
    active_page = req.query.page;
  }

  // Filter: Keywords
  if (keyword) {
    where['$or'] = [
      {name: new RegExp(keyword, 'i')},
      {email: new RegExp(keyword, 'i')}
    ]
  }

  // // Filter country
  // if (country) {
  //   const matchingCountry = countries.find(c => c._id.toString() === country);
  //   if (matchingCountry) {
  //     where.country = new RegExp(matchingCountry.country.toLowerCase(), 'i');
  //   }
  // }

  // Sorting
  let sort = { _id: 1 };
  if (req.query.order && req.query.orderBy) {
    sort = {};
    sort[req.query.orderBy] = req.query.order === 'asc' ? 1 : -1;
  }

  let aggregateQuery = [];
  
  // where
  aggregateQuery.push({
    $match: where
  });
  
  // joins
  aggregateQuery.push({
    $lookup: {
      from: 'userbookings',
      localField: '_id',
      foreignField: 'user',
      as: 'userBookings'
    }
  });
  aggregateQuery.push({
    $lookup: {
      from: 'completed_bookings',
      localField: '_id',
      foreignField: 'user',
      as: 'completedBookings'
    }
  });

  // populations
  aggregateQuery.push({
    $project: {
      _id: '$_id',
      name: 1,
      last_name: 1,
      email: 1,
      mobile: 1,
      city: 1,
      country: 1,
      promocodes: 1,
      image: 1,
      favourites: 1,
      status: 1,
      device_token: 1,
      device_type: 1,
      device_type: 1,
      bookings: {$add: [{$size: '$userBookings'}, {$size: '$completedBookings'}]},
    }
  });

  // Sort
  aggregateQuery.push({
    $sort: sort
  });

  // skip
  aggregateQuery.push({
    $skip: req.skip
  });

  // limit
  aggregateQuery.push({
    $limit: req.query.limit
  });

  const resources = await User.aggregate(aggregateQuery).exec();
  // console.log('aggregateQuery', JSON.stringify(aggregateQuery));

  /**
   * Aggregationn, so skip manual
   
    // User
    //   .find(where)
    //   .select('+email')
    //   .sort(sort)
    //   .populate(resourcePopulations)
    //   .limit(req.query.limit)
    //   .skip(req.skip)
    //   .lean()
    //   .exec(),
   */
  const [list, itemCount] = await Promise.all([
    Promise.resolve(resources),
    User.countDocuments(where)
  ]);

  const pageCount = Math.ceil(itemCount / req.query.limit);

  let data = {
    list: list,
    countries: countries,
    itemCount: itemCount,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    active_page
  };
  res.status(200).send(data).end();
};

const getById = async (req, res) => {
  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_USERS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }
  let where = {
    _id: req.params.id
  };

  try {
    let [resource] = await Promise.all([
      User
        .findOne(where)
        .populate(resourcePopulations)
        .lean()
        .exec()
    ]);

    if (!resource) {
      return res.status(404).send({
        message: 'Resource does not exist'
      }).end();
    }

    resource = await getExtraUserInformation(resource);
    res.status(200).send(resource).end();

  } catch (e) {
    return res.status(500).send({
      message: 'Sorry, there was an error in performing this operation'
    }).end();
  }
};

const create = async (req, res) => {
  const user = req.user;
  const {permissions} = user.role;
  const resourceData = req.body;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_USERS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }

  try {
    // Set password
    var password = generator.generate({
      length: 10,
      numbers: true
    });
    resourceData.password = await bcrypt.hashSync(password, 10);

    const resource = new User(resourceData);
    await resource.save()

    if (resource) {
      res.status(200).send(resource).end();
    } else {
      res.status(500).send({
        message: 'Sorry, there was an error in performing this operation'
      }).end();
    }
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      error: e
    }).end();
  }
};

const modify = async (req, res) => {
  const user = req.user;
  const {permissions} = user.role;
  const updatedData = req.body;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_USERS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }
  let where = {
    _id: req.params.id
  };

  try {
    // Return updated doc
    let resource = await User
      .findOneAndUpdate(where, { $set: updatedData }, { new: true })
      .populate(resourcePopulations)
      .exec()
    ;

    if (resource) {
      resource = await getExtraUserInformation(resource);
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

const remove = async (req, res) => {
  const user = req.user;
  const {permissions} = user.role;
  const updatedData = req.body;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_USERS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }
  let where = {
    _id: req.params.id
  };

  try {
    // Return updated doc
    const resource = await User
      .deleteOne(where)
      .exec()
    ;

    if (resource) {
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

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), list);
router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), getById);
// router.post("/", jwtMiddleware.administratorAuthenticationRequired, create);
router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, modify);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);


module.exports = router;
