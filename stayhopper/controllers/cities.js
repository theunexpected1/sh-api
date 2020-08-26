const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const City = require("../db/models/cities");

router.get("/", async (req, res) => {
  let cities = await City.find();
  let data = {
    cities: cities
  };
  res.render("cities/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/cities");
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
  let name = req.body.name;
  if (!name) {
    return res.json({ status: 0, message: "City Name is required" });
  }
  let city = new City();
  city.name = name;
  if (req.files.length > 0) {
    city.image = req.files[0].path || null;
  }
  try {
    await city.save();
    return res.json({
      status: 1,
      message: "City is Added successfully!",
      id: city._id
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
  let city = await City.findOne({ _id: id });
  if (city) {
    city.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete City!" });
  }
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let city = await City.findOne({ _id: id });
  if (city) {
    return res.json({ status: 1, data: city });
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
    let name = req.body.name;
    if (!name) {
      return res.json({ status: 0, message: "City Name is required" });
    }
    let city = await City.findOne({_id:req.body.id});
    city.name = name;
    if (req.files.length > 0) {
        city.image = req.files[0].path || null;
    }
    try {
      await city.save();
      return res.json({
        status: 1,
        message: "City Updated successfully!",
        id: city._id
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
