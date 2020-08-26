const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const path = require("path");
const paginate = require("express-paginate");
const config = require("config");

const Service = require("../../../db/models/services");
const jwtMiddleware = require("../../../middleware/jwt");


// START: Customize
const ModuleTitle = "Service";
const ModuleModel = Service;
const selections = '';
const populations = '';

const hasPermissions = (req, res) => {
  // Permissions
  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.SHOW_SETTINGS) > -1;
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

  return where;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/services");
  },
  filename: (req, file, cb) => {
    var ext = (path.extname(file.originalname) || '').toLowerCase();
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});

let upload = pify(
  multer({
    storage: storage,
    fileFilter: function(req, file, callback) {
      var ext = (path.extname(file.originalname) || '').toLowerCase();
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
// END: Customize


// Generic Listing+CRUD
const list = async (req, res) => {
  // if (hasPermissions(req, res)) {
    try {
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

      const [list, itemCount] = await Promise.all([
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
  // }
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
};

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

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), list);
router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), single);
router.post("/", jwtMiddleware.administratorAuthenticationRequired, upload, create);
router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, upload, modify);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);

module.exports = router;
