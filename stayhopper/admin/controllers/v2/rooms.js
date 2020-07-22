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

const Country = require("../../../db/models/countries");

const Property = require("../../../db/models/properties");
const Room = require("../../../db/models/rooms");
const Role = require("../../../db/models/roles");
const Administrator = require("../../../db/models/administrators");

const _ = require("underscore");
const jwtMiddleware = require("../../../middleware/jwt");

// START: Customize
const ModuleTitle = "Room";
const ModuleModel = Room;
const selections = '';
const populations = [
  {
    path: "property_id"
  },
  {
    path: "property"
  },
  {
    path: "room_type"
  },
  {
    path: "room_name"
  },
  {
    path: "bed_type"
  },
  {
    path: "services"
  },
  {
    path: 'number_of_guests'
  }
];

const singlePopulations = [
  {
    path: "property_id",
    populate: [
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
    ]
  },
  {
    path: "property"
  },
  {
    path: "room_type"
  },
  {
    path: "room_name"
  },
  {
    path: "bed_type"
  },
  {
    path: "services"
  },
  {
    path: 'number_of_guests'
  }
];

const hasPermissions = (req, res) => {
  // Permissions

  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_ROOMS) > -1;
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
  const where = {};

  let propertyId = req.query.propertyId;

  if (propertyId) {
    where.property_id = propertyId;
  }

  return where;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/files/original/rooms");
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});

let upload = pify(
  multer({
    storage: storage,
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

    // resourceData.trade_licence = resourceData.trade_licence || {};
    // // Set the newly uploaded file in the resource body
    // if (req.files['trade_licence[trade_licence_attachment]']) {
    //   resourceData.trade_licence.trade_licence_attachment = req.files['trade_licence[trade_licence_attachment]'][0].path || null;
    // }

    // Ensure no extra beds are provided if the option is disabled
    if (!resourceData.extrabed_option) {
      resourceData.extrabed_number = 0;
    }

    return resourceData;
  } catch (e) {
    console.log('e', e);
    throw new Error("Could not upload");
  }
}

// END: Customize


// Generic Listing+CRUD

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

      let [list, itemCount] = await Promise.all([
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

      const pageCount = Math.ceil(itemCount / req.query.limit);
      let data = {
        list: list,
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
          .populate(singlePopulations)
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
      await ModuleModel.populate(resource, singlePopulations);

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
        await ModuleModel.populate(resource, singlePopulations);
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

/** Rates */
const createRate = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let resourceData = req.body || {};

      let where = {_id: req.params.id};
      const resource = await ModuleModel.findOne(where);
      if (resource) {
        const rate = resource.rates.create(resourceData);
        resource.rates.push(rate);
        await resource.save()

        res.status(200).send(rate).end();
      } else {
        res.status(404).send({
          message: 'Sorry, resource does not exist'
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

const modifyRate = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let resourceData = req.body || {};
      if (!req.params.rateId) {
        return res.status(500).send({
          message: 'Sorry, no Rate specified to modify'
        });
      }

      let where = {
        _id: req.params.id,
        'rates._id': req.params.rateId
      };

      const resource = await ModuleModel.findOne(where);
      if (resource) {
        const rate = resource.rates.id(req.params.rateId);
        rate.set(resourceData);
        await resource.save();
        res.status(200).send(rate).end();
      } else {
        res.status(404).send({
          message: 'Sorry, resource does not exist'
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

const removeRate = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      if (!req.params.rateId) {
        return res.status(500).send({
          message: 'Sorry, no Rate specified to modify'
        });
      }

      let where = {
        _id: req.params.id,
        'rates._id': req.params.rateId
      };

      const resource = await ModuleModel.findOne(where);
      if (resource) {
        resource.rates.pull(req.params.rateId);
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


router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), list);
router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), single);
router.post("/", jwtMiddleware.administratorAuthenticationRequired, upload, create);
router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, upload, modify);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);

router.post("/:id/rates", jwtMiddleware.administratorAuthenticationRequired, upload, createRate);
router.put("/:id/rates/:rateId", jwtMiddleware.administratorAuthenticationRequired, upload, modifyRate);
router.delete("/:id/rates/:rateId", jwtMiddleware.administratorAuthenticationRequired, removeRate);

module.exports = router;
