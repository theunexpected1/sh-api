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

const GuestNumber = require("../../db/models/guestnumbers");

router.get("/", async (req, res) => {
  let no_guests = await GuestNumber.find();
  let data = {
    no_guests: no_guests
  };
  res.render("admin/no_guests/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/no_guests");
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
  let guest_number = req.body.guest_number_name;
  let guest_number_value = req.body.guest_number;
  if (!guest_number) {
    return res.json({ status: 0, message: "Guest Number Name is required" });
  }
  if (!guest_number_value) {
    return res.json({ status: 0, message: "Guest Number Value is required" });
  }
  let guestnumber = new GuestNumber();
  guestnumber.name = guest_number;
  guestnumber.value = guest_number_value;
  if (req.files.length>0) {
    // let app_url = req.headers.origin;
    // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    // request(app_url+"/"+req.files[0].path).pipe(resizer);
    guestnumber.image = req.files[0].path || null;
  }
  try {
    await guestnumber.save();
    return res.json({
      status: 1,
      message: "Guest Number Added successfully!",
      id: guestnumber._id
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
  let guestnumber = await GuestNumber.findOne({ _id: id });
  if (guestnumber) {
    guestnumber.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete Guest Number!" });
  }
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let guestnumber = await GuestNumber.findOne({ _id: id });
  if (guestnumber) {
    return res.json({ status: 1, data: guestnumber });
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
  let guest_number = req.body.guest_number_name;
  let guest_number_value = req.body.guest_number;
  if (!guest_number) {
    return res.json({ status: 0, message: "Guest Number Name is required" });
  }
  if (!guest_number_value) {
    return res.json({ status: 0, message: "Guest Number Value is required" });
  }
  let guestnumber = await GuestNumber.findOne({_id:req.body.id});
  guestnumber.name = guest_number;
  guestnumber.value = guest_number_value;
  if (req.files.length > 0) {
    // let app_url = req.headers.origin;
    // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    // request(app_url+"/"+req.files[0].path).pipe(resizer);
    guestnumber.image = req.files[0].path || null;
  }
  try {
    await guestnumber.save();
    return res.json({
      status: 1,
      message: "Guest Number Updated successfully!",
      id: guestnumber._id
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
