const db = require("../../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");
const _ = require("underscore");

const propertiesCrump = require("../../middleware/propertiesCrump");

const Property = require("../../db/models/properties");
const PropertyType = require("../../db/models/propertytypes");

router.get("/:id", propertiesCrump, async (req, res) => {
  property = await Property.findOne({ _id: req.params.id });
  let data = {
    property: property,
    _: _
  };
  res.render("admin/nearby/list", data);
});

router.get("/:id/details", async (req, res) => {
    let property = req.query.property;
    let id = req.params.id;
    property = await Property.findOne({_id:property,'nearby':id});

    return res.json({property,id})
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/nearby");
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
router.post("/", async (req, res) => {
  try {
    await upload(req, res);
  } catch (err) {
    return res.json({ status: 0, message: "Could not insert" });
  }
  let property = await Property.findOne({ _id: req.body.property });
  if (property) {
    let name = req.body.nearby_place;
    if (!name) {
      return res.json({
        status: 0,
        message: "Nearby location name is required"
      });
    }
    image = null;
    if (req.files.length > 0) {
      image = req.files[0].path || null;
    }
    try {
      let nearby = {
        name,
        image
      };
      if (property.nearby) {
        property.nearby.push(nearby);
      } else {
        property.nearby = nearby;
      }
      await property.save();
      return res.json({
        status: 1,
        message: "Nearby place Added successfully!"
      });
    } catch (error) {
      var errors = [];
      for (field in error.errors) {
        errors.push(error.errors[field].message);
      }
      return res.json({ status: 0, errors: errors });
    }
  } else {
    return res.json({
      status: 0,
      message: "Nearby place could not add to the property"
    });
  }
});

router.post("/delete", async (req, res) => {
  let id = req.body.id;
  let property = req.body.property;
  property = await Property.findOne({ _id: property });
  if (property) {
    property.nearby.remove(id);
    try {
      await property.save();
      return res.json({
        status: 1,
        message: "Nearby location removed successfully!"
      });
    } catch (err) {
      return res.json({
        status: 0,
        message: "Could not delete nearby location"
      });
    }
  } else {
    return res.json({ status: 0, message: "No property found" });
  }
});
module.exports = router;
