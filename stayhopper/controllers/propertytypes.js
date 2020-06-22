const db = require("../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const PropertyType = require("../db/models/propertytypes");

router.get("/", async (req, res) => {
  propertyTypes = await PropertyType.find();
  let data = {
    propertyTypes: propertyTypes
  };
  res.render("propertytypes/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/propertytypes");
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
  }).array("image")
);
router.post("/", async (req, res) => {
  try {
    await upload(req, res);
  } catch (err) {
    return res.json({ status: 0, message: "Could not insert" });
  }
  let property_type = req.body.property_type;
  if (!property_type) {
    return res.json({ status: 0, message: "Property type name is required" });
  }
  let propertytype = new PropertyType();
  propertytype.name = property_type;
  if (req.files.length>0) {
    propertytype.image = req.files[0].path || null;
  }
  try {
    await propertytype.save();
    return res.json({
      status: 1,
      message: "Property Type Added successfully!",
      id: propertytype._id
    });
  } catch (error) {
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }
});
router.get("/delete", async (req, res) => {
  let id = req.query.id;
  let property_type = await PropertyType.findOne({ _id: id });
  if (property_type) {
    property_type.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete proeprty type!" });
  }
});
router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let property_type = await PropertyType.findOne({ _id: id });
  if (property_type) {
    return res.json({ status: 1, data: property_type });
  } else {
    return res.json({ status: 0, message: "No data" });
  }
});
router.post('/update',async(req,res)=>{
  try {
    await upload(req, res);
  } catch (err) {
    return res.json({ status: 0, message: "Could not update" });
  }
  let property_type = req.body.property_type;
  if (!property_type) {
    return res.json({ status: 1, message: "Property type name is required" });
  }
  let propertytype = await PropertyType.findOne({_id:req.body.id});
  propertytype.name = property_type;
  if (req.files.length > 0) {
    propertytype.image = req.files[0].path || null;
  }
  try {
    await propertytype.save();
    return res.json({
      status: 1,
      message: "Property Type Updated successfully!",
      id: propertytype._id
    });
  } catch (error) {
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }
});
module.exports = router;
