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

const BedNumber = require("../../db/models/bednumbers");

router.get("/", async (req, res) => {
  let no_beds = await BedNumber.find();
  let data = {
    no_beds: no_beds
  };
  res.render("admin/no_beds/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/no_beds");
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
  let bed_number = req.body.bed_number_name;
  let bed_number_value = req.body.bed_number;
  if (!bed_number) {
    return res.json({ status: 0, message: "Bed Number Name is required" });
  }
  if (!bed_number_value) {
    return res.json({ status: 0, message: "Bed Number Value is required" });
  }
  let bednumber = new BedNumber();
  bednumber.name = bed_number;
  bednumber.value = bed_number_value;
  if (req.files.length>0) {
    // let app_url = req.headers.origin;
    // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    // request(app_url+"/"+req.files[0].path).pipe(resizer);
    bednumber.image = req.files[0].path || null;
  }
  try {
    await bednumber.save();
    return res.json({
      status: 1,
      message: "Bed Number Added successfully!",
      id: bednumber._id
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
  let bednumber = await BedNumber.findOne({ _id: id });
  if (bednumber) {
    bednumber.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete Bed Number!" });
  }
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let bednumber = await BedNumber.findOne({ _id: id });
  if (bednumber) {
    return res.json({ status: 1, data: bednumber });
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
  let bed_number = req.body.bed_number_name;
  let bed_number_value = req.body.bed_number;
  if (!bed_number) {
    return res.json({ status: 0, message: "Bed Number Name is required" });
  }
  if (!bed_number_value) {
    return res.json({ status: 0, message: "Bed Number Value is required" });
  }
  let bednumber = await BedNumber.findOne({_id:req.body.id});
  bednumber.name = bed_number;
  bednumber.value = bed_number_value;
  if (req.files.length > 0) {
    // let app_url = req.headers.origin;
    // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    // request(app_url+"/"+req.files[0].path).pipe(resizer);
    bednumber.image = req.files[0].path || null;
  }
  try {
    await bednumber.save();
    return res.json({
      status: 1,
      message: "Bed Number Updated successfully!",
      id: bednumber._id
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
