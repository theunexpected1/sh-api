const db = require("../../../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const path = require("path");
const paginate = require("express-paginate");
const config = require("config");

const Property = require("../../../db/models/properties");
const Room = require("../../../db/models/rooms");
const Role = require("../../../db/models/roles");
const HotelAdmin = require("../../../db/models/hoteladmins");
const Administrator = require("../../../db/models/administrators");
const UserBooking = require("../../../db/models/userbookings");

const _ = require("underscore");
const jwtMiddleware = require("../../../middleware/jwt");

// START: Customize
const ModuleTitle = "Property";
const ModuleModel = Property;
const selections = '';
const populations = [
  {
    path: "rating"
  },
  {
    path: "company"
  },
  {
    path: "rooms"
  },
  {
    path: "type"
  },
  {
    path: "contactinfo.country"
  },
  {
    path: "contactinfo.city"
  }
];

const hasPermissions = (req, res) => {
  // Permissions

  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_PROPERTIES) > -1;
  if (hasResourceAccess) {
    return true;
  } else {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
    return false;
  }
}

const prepareQueryForListing = (req) => {

  // Further permissions
  let user = req.user;
  let {permissions} = user.role;
  const hasAllPropertiesAccess = permissions.indexOf(config.permissions.LIST_ALL_PROPERTIES) > -1;
  const hasOwnPropertiesAccess = permissions.indexOf(config.permissions.LIST_OWN_PROPERTIES) > -1;

  const where = {};

  let select_company = req.query.company;
  let keyword = req.query.q;
  let approved = req.query.approved;
  let published = req.query.published;

  // Filter: User's properties - Restrict to logged in user viewing their own properties if they dont have access to all
  if (hasOwnPropertiesAccess && !hasAllPropertiesAccess) {
    where._id = {
      $in: user.properties
    }
  }

  if (select_company) {
    where.company = select_company;
  }

  // Filter: Keywords
  if (keyword) {
    where['$or'] = [
      {name: new RegExp(keyword, 'i')},
      {description: new RegExp(keyword, 'i')}
    ]
  }

  // Filter Approval status
  if (approved || approved === false) {
    where.approved = approved;
  }

  // Filter Publish status
  if (published || published === false) {
    where.published = published;
  }

  return where;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/files/properties");
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});

let upload = pify(
  multer({ storage: storage }).fields([
    { name: "trade_licence_attachment" },
    { name: "passport_attachment" }
  ])
);

const preCreateOrUpdate = async (req, res, resourceData) => {
  try {
    // await upload(req, res);
    // Set the newly uploaded file in the resource body
    if (req.files && req.files.length > 0) {
      resourceData.image = req.files[0].path || null;
    }
    return resourceData;
  } catch (e) {
    console.log('e', e);
    throw new Error("Could not upload");
  }
}


const getExtraResourceInformation = async (resource) => {
  let rooms = await Room.aggregate([
    {
      $match: { property_id: db.Types.ObjectId(resource._id) }
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
  resource.total_rooms = total_rooms;
  return resource;
}

// END: Customize


// Generic Listing+CRUD

// const property_active_bookings = async property_id => {
//   return await UserBooking.find({
//     property: property_id
//   }).count();
// };

const list = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      // Further permissions
      let user = req.user;
      let {permissions} = user.role;
      const hasAllPropertiesAccess = permissions.indexOf(config.permissions.LIST_ALL_PROPERTIES) > -1;
      const hasOwnPropertiesAccess = permissions.indexOf(config.permissions.LIST_OWN_PROPERTIES) > -1;

      // Where condition
      const where = prepareQueryForListing(req);

      // Pagination
      let active_page = 1;
      if (req.query.page) {
        active_page = req.query.page;
      }

      // Sorting
      let sort = { _id: 1 };
      if (req.query.order && req.query.orderBy) {
        sort = {};
        sort[req.query.orderBy] = req.query.order === 'asc' ? 1 : -1;
      }

      // Ensure to filter by hotel admin (not super admin)
      // Hotel Admin role is one who
      // - can access OWN Properties
      // - cannot access ALL Properties
      let hotelAdminRole = await Role.findOne({permissions: {$in: ['LIST_OWN_PROPERTIES'], $nin: ['LIST_ALL_PROPERTIES']}});
      if (hotelAdminRole) {
        hotelAdminRole = hotelAdminRole._id;
      }

      let [hotelAdmins, list, itemCount] = await Promise.all([
        hasAllPropertiesAccess ? Administrator.find({role: hotelAdminRole}) : Promise.resolve([]),
        ModuleModel
          .find(where)
          .select(selections || '')
          .populate(populations || '')
          .sort(sort)
          .limit(req.query.limit)
          .skip(req.skip)
          .lean()
          .exec(),
        ModuleModel.countDocuments(where)
      ]);
      list = await Promise.all(list.map(getExtraResourceInformation))

      const pageCount = Math.ceil(itemCount / req.query.limit);
      let data = {
        list: list,
        hotelAdmins,
        itemCount: itemCount,
        pageCount: pageCount,
        pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
        active_page
      };
      res.status(200).send(data).end();
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};

const getById = async (req, res) => {}
const create = async (req, res) => {}
const modify = async (req, res) => {}
const remove = async (req, res) => {}


router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), list);
router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), getById);
router.post("/", jwtMiddleware.administratorAuthenticationRequired, upload, create);
router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, upload, modify);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);

module.exports = router;
