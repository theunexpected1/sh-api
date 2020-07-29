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
const sharp = require('sharp');
const request = require('request');

const PropertyType = require("../../../db/models/propertytypes");
const PropertyRating = require("../../../db/models/propertyratings");
const Country = require("../../../db/models/countries");
const City = require("../../../db/models/cities");

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
    path: "administrator"
  },
  {
    path: "allAdministrators",
    populate: {
      path: 'role'
    }
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
  },
  {
    path: "policies"
  },
  {
    path: "terms"
  },
  {
    path: "currency"
  },
  {
    path: "payment.country"
  },
  {
    path: "payment.currency"
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
  let country = req.query.country;
  let city = req.query.city;

  // Filter: User's properties - Restrict to logged in user viewing their own properties if they dont have access to all
  if (hasOwnPropertiesAccess && !hasAllPropertiesAccess) {
    where['$or'] = [
      {administrator: user._id},
      // Add staff roles here
    ]
  }

  // Filter: Keywords
  if (keyword) {
    where['$or'] = where['$or'] || [];
    where['$or'].push({name: new RegExp(keyword, 'i')});
    where['$or'].push({description: new RegExp(keyword, 'i')});
  }

  if (select_company) {
    // where.company = select_company;
    where['$or'] = where['$or'] || [];
    where['$or'].push({administrator: select_company});
    where['$or'].push({allAdministrators: {
      $in: [select_company]
    }});
  }

  if (country) {
    where['contactinfo.country'] = country;
  }

  if (city) {
    where['contactinfo.city'] = city;
  }

  // Filter Approval status
  if (approved || approved === false) {
    where.approved = approved;
  }

  // Filter Publish status
  if (published || published === false) {
    where.published = published;
  }

  // console.log('where', where);
  return where;
}

// Upload for Properties documents
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
    { name: "trade_licence[trade_licence_attachment]" },
    { name: "trade_licence[passport_attachment]" }
  ])
);



// Upload for Nearby Places
const storageNearby = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/nearby");
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});

let uploadNearby = pify(
  multer({
    storage: storageNearby,
    fileFilter: function(req, file, callback) {
      var ext = path.extname(file.originalname);
      if (
        ext !== ".svg" &&
        ext !== ".png" &&
        ext !== ".jpg" &&
        ext !== ".gif" &&
        ext !== ".jpeg"
      ) {
        return callback(new Error("Only images are allowed"));
      }
      callback(null, true);
    }
  }).array("image")
);


// Upload for Photos
const storagePhotos = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/files/original/properties");
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});

let uploadPhotos = pify(
  multer({
    storage: storagePhotos,
    fileFilter: function(req, file, callback) {
      var ext = path.extname(file.originalname);
      if (
        ext !== ".svg" &&
        ext !== ".png" &&
        ext !== ".jpg" &&
        ext !== ".gif" &&
        ext !== ".jpeg"
      ) {
        return callback(new Error("Only images are allowed"));
      }
      callback(null, true);
    }
  }).array("file")
);


const preCreateOrUpdate = async (req, res, resourceData) => {
  try {

    resourceData.trade_licence = resourceData.trade_licence || {};
    // Set the newly uploaded file in the resource body
    if (req.files['trade_licence[trade_licence_attachment]']) {
      resourceData.trade_licence.trade_licence_attachment = req.files['trade_licence[trade_licence_attachment]'][0].path || null;
    }

    if (req.files['trade_licence[passport_attachment]']) {
      resourceData.trade_licence.passport_attachment = req.files['trade_licence[passport_attachment]'][0].path || null;
    }

    // Parse if necessary
    // - weekends
    if (resourceData.weekends) {
      if (typeof resourceData.weekends === 'string') {
        resourceData.weekends = resourceData.weekends.split(',').map(we => we.trim().toLowerCase());
      }
    } else {
      resourceData.weekends = [];
    }

    // Ensure location is a valid Geo type
    if (resourceData.location && !resourceData.location.type) {
      resourceData.location.type = 'Point';
    }

    // - secondaryReservationEmails
    if (resourceData.secondaryReservationEmails) {
      resourceData.secondaryReservationEmails = resourceData.secondaryReservationEmails.toLowerCase();
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
      // Hotel Admin role, or Receptionist role is one who
      // - can access OWN Properties
      // - cannot access ALL Properties
      let hotelAdminRoles = await Role.find({permissions: {$in: ['LIST_OWN_PROPERTIES'], $nin: ['LIST_ALL_PROPERTIES']}});
      let receptionistRoles = await Role.find({permissions: {$in: ['LIST_OWN_PROPERTIES'], $nin: ['LIST_ALL_PROPERTIES', 'LIST_INVOICES']}});
      let ids = [];
      if (hotelAdminRoles) {
        ids = ids.concat(hotelAdminRoles.map(role => role._id));
      }
      if (receptionistRoles) {
        ids = ids.concat(receptionistRoles.map(role => role._id));
      }

      let [hotelAdmins, countries, list, itemCount] = await Promise.all([
        hasAllPropertiesAccess ? Administrator.find({role: {$in: ids}}) : Promise.resolve([]),
        Country.find({}),
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
        countries,
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

const single = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let where = {_id: req.params.id};
      const [resource] = await Promise.all([
        ModuleModel
          .findOne(where)
          .select(selections)
          .populate(populations)
          .lean()
          .exec()
      ]);

      if (!resource) {
        return res.status(404).send({
          message: `${ModuleTitle} does not exist`
        }).end();
      }

      res.status(200).send(resource).end();
    } catch (e) {
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}


const create = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      // Pre call could be anything to be done before a POST / PUT is performed
      // This could also be empty
      let resourceData = req.body;
      resourceData = await preCreateOrUpdate(req, res, resourceData);

      const resource = new ModuleModel(resourceData);
      await resource.save()
      await ModuleModel.populate(resource, populations);

      if (resource) {
        res.status(200).send(resource).end();
      } else {
        res.status(500).send({
          message: 'Sorry, there was an error in performing this action'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action',
        error: e
      }).end();
    }
  }
}

const modify = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      // Pre call could be anything to be done before a POST / PUT is performed
      // This could also be empty
      let resourceData = req.body;
      resourceData = await preCreateOrUpdate(req, res, resourceData);

      let where = {_id: req.params.id};  
      const resource = await ModuleModel.findOne(where);
      if (resource) {
        Object.keys(resourceData).map(key => resource[key] = resourceData[key]);
        await resource.save();
        await ModuleModel.populate(resource, populations);
        res.status(200).send(resource).end();
      } else {
        res.status(404).send({
          message: 'Sorry, resource does not exist'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}

const remove = async (req, res) => {
  if (hasPermissions(req, res)) {
    let where = {_id: req.params.id};
    try {
      // Return updated doc
      const resource = await ModuleModel.deleteOne(where).exec();
      res.status(200).send(resource).end();
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this operation'
      }).end();
    }
  }
}



/** Nearby */


const createNearby = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let where = {_id: req.params.id};
      let resource = await ModuleModel.findOne(where);

      if (!resource) {
        return res.status(404).send({
          message: `${ModuleTitle} does not exist`
        }).end();
      }

      let name = req.body.name;
      if (!name) {
        return res.json({
          status: 0,
          message: "Nearby location name is required"
        });
      }

      image = req.body.image;
      if (req.files && req.files.length > 0) {
        image = req.files[0].path || null;
      }
      let nearby = { name, image};
      const nearbyRecord = resource.nearby.create(nearby);
      resource.nearby.push(nearbyRecord);
      await resource.save()
      return res.status(200).send(nearbyRecord).end();

    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action',
        error: e
      }).end();
    }
  }
};

const removeNearby = async(req, res) => {
  if (hasPermissions(req, res)) {
    try {
      if (!req.params.nearbyId) {
        return res.status(500).send({
          message: 'Sorry, invalid nearby place specified to remove'
        });
      }

      let where = {
        _id: req.params.id,
        'nearby._id': req.params.nearbyId
      };
      
      const resource = await ModuleModel.findOne(where);
      if (resource) {
        resource.nearby.pull(req.params.nearbyId);
        await resource.save();
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
  }
}


/** Photos */
const createPhoto = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let image = null;
      let where = {_id: req.params.id};
      let resource = await ModuleModel.findOne(where);
      if (req.files && resource) {
        let api_url = config.api_url;
        filename = path.basename(req.files[0].path);
        if (filename) {
          const resizer = sharp()
            .resize(800)
            .toFile('public/files/properties/' + filename, async (err, info) => {
              console.log('err: ', err);
              console.log('info: ', info);

              if (err) {
                res.status(500).send({
                  message: 'Sorry, there was an error in performing this action'
                }).end();
              } else {
                image = 'public/files/properties/'+filename;

                let images = resource.images;
                // let featured_images = resource.featured;
                // if((typeof featured_images != 'undefined' && featured_images.length <= 0) || typeof featured_images == 'undefined'){
                //   featured_images = [image]
                //   resource.featured = featured_images;
                //   featured = true;
                // }
                if (images) {
                  images.push(image);
                } else {
                  images = [image];
                }
                resource.images = images;
                await resource.save();
                res.status(200).send({
                  images: resource.images,
                  featured: resource.featured
                }).end();
              }
            })
          ;
          request(api_url + req.files[0].path).pipe(resizer);
        } else {
          res.status(500).send({
            message: 'Sorry, there was an error in performing this action'
          }).end();
        }
      } else {
        return res.status(404).send({
          message: 'Sorry, resource does not exist'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}

const removePhoto = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let image = req.body.image;
      let where = {_id: req.params.id};
      let resource = await ModuleModel.findOne(where);
      if (resource.images && resource.images.length > 0) {
        let index = null;
        images = resource.images.filter(i => i !== image);
        resource.images = images;
        await resource.save();
        res.status(200).send({
          images: resource.images,
          featured: resource.featured
        }).end();
      } else {
        res.status(404).send({
          message: `Resource does not exist`
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}

const featurePhoto = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let image = req.body.image;
      let where = {_id: req.params.id};
      let resource = await ModuleModel.findOne(where);
      let status = 1;
      let featured = [image];
      resource.featured = featured;
      let images = resource.images;
      images = _.without(images, image);      
      images.unshift(image);
      resource.images = images;
      await resource.save();
      res.status(200).send({
        images: resource.images,
        featured: resource.featured
      }).end();
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), list);
router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), single);
router.post("/", jwtMiddleware.administratorAuthenticationRequired, upload, create);
router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, upload, modify);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);

router.post("/:id/nearby", jwtMiddleware.administratorAuthenticationRequired, uploadNearby, createNearby);
router.delete("/:id/nearby/:nearbyId", jwtMiddleware.administratorAuthenticationRequired, removeNearby);

router.post("/:id/photos", jwtMiddleware.administratorAuthenticationRequired, uploadPhotos, createPhoto);
router.post("/:id/photos/feature", jwtMiddleware.administratorAuthenticationRequired, featurePhoto);
// post, not delete, because we're sending image url in post data
router.post("/:id/photos/remove", jwtMiddleware.administratorAuthenticationRequired, removePhoto);

module.exports = router;
