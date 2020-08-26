const db = require("../../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const sharp = require('sharp');
const request = require('request');

const BedType = require("../../db/models/bedtypes");

router.get("/", async (req, res) => {
  let bedTypes = await BedType.find();
  let data = {
    bedTypes: bedTypes
  };
  res.render("admin/bedtypes/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/bedtypes");
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
  let bed_type = req.body.bed_type;
  if (!bed_type) {
    return res.json({ status: 0, message: "Bed Type is required" });
  }
  let bedtype = new BedType();
  bedtype.name = bed_type;
  if (req.files.length > 0) {
    // let app_url = req.headers.origin;
    // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    // request(app_url+"/"+req.files[0].path).pipe(resizer);
    bedtype.image = req.files[0].path || null;
  }
  try {
    await bedtype.save();
    return res.json({
      status: 1,
      message: "Bed Type Added successfully!",
      id: bedtype._id
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
  let bedtype = await BedType.findOne({ _id: id });
  if (bedtype) {
    bedtype.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete bed type!" });
  }
});
router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let bedtype = await BedType.findOne({ _id: id });
  if (bedtype) {
    return res.json({ status: 1, data: bedtype });
  } else {
    return res.json({ status: 0, message: "No data" });
  }
});

router.post("/update", async (req, res) => {
  try {
    await upload(req, res);
  } catch (err) {
    return res.json({ status: 0, message: "Could not update" });
  }
  let bed_type = req.body.bed_type;
  if (!bed_type) {
    return res.json({ status: 0, message: "Room Name is required" });
  }
  let bedtype = await BedType.findOne({ _id: req.body.id });
  bedtype.name = bed_type;
  if (req.files.length > 0) {
    // let app_url = req.headers.origin;
    // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    // request(app_url+"/"+req.files[0].path).pipe(resizer);    
    bedtype.image = req.files[0].path || null;
  }
  try {
    await bedtype.save();
    return res.json({
      status: 1,
      message: "Bed Type Updated successfully!",
      id: bedtype._id
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
