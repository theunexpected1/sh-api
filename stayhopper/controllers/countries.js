const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const Country = require("../db/models/countries");

router.get("/", async (req, res) => {
  let countries = await Country.find();
  let data = {
    countries: countries
  };
  res.render("countries/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/countries");
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
  let country_name = req.body.country;
  let isd_code = req.body.isd;
  if (!country_name) {
    return res.json({ status: 0, message: "Country Name is required" });
  }
  if (!isd_code) {
    return res.json({ status: 0, message: "ISD Code is required" });
  }
  let country = new Country();
  country.country = country_name;
  country.isd_code = isd_code;
  if (req.files.length>0) {
    country.image = req.files[0].path || null;
  }
  try {
    await country.save();
    return res.json({
      status: 1,
      message: "Country Added successfully!",
      id: country._id
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
  let country = await Country.findOne({ _id: id });
  if (country) {
    country.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete Country!" });
  }
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let country = await Country.findOne({ _id: id });
  if (country) {
    return res.json({ status: 1, data: country });
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
  let country_name = req.body.country;
  let isd_code = req.body.isd;
  if (!country_name) {
    return res.json({ status: 0, message: "Country Name is required" });
  }
  if (!isd_code) {
    return res.json({ status: 0, message: "ISD Code is required" });
  }
  let country = await Country.findOne({_id:req.body.id});
  country.country = country_name;
  country.isd_code = isd_code;
  if (req.files.length > 0) {
    country.image = req.files[0].path || null;
  }
  try {
    await country.save();
    return res.json({
      status: 1,
      message: "Country Updated successfully!",
      id: country._id
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
