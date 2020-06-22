const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const Currency = require("../db/models/currencies");

router.get("/", async (req, res) => {
  let currencies = await Currency.find();
  let data = {
    currencies: currencies
  };
  res.render("currencies/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/currencies");
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
  let currency_name = req.body.currency;
  let currency_code = req.body.code;
  if (!currency_name) {
    return res.json({ status: 0, message: "Currency Name is required" });
  }
  if (!currency_code) {
    return res.json({ status: 0, message: "Currency Code is required" });
  }
  let currency = new Currency();
  currency.name = currency_name;
  currency.code = currency_code;
  if (req.files.length > 0) {
    currency.image = req.files[0].path || null;
  }
  try {
    await currency.save();
    return res.json({
      status: 1,
      message: "Currency Added successfully!",
      id: currency._id
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
  let currency = await Currency.findOne({ _id: id });
  if (currency) {
    currency.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete Currency!" });
  }
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let currency = await Currency.findOne({ _id: id });
  if (currency) {
    return res.json({ status: 1, data: currency });
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
  let currency_name = req.body.currency;
  let currency_code = req.body.code;
  if (!currency_name) {
    return res.json({ status: 0, message: "Currency Name is required" });
  }
  if (!currency_code) {
    return res.json({ status: 0, message: "Currency Code is required" });
  }
  let currency = await Currency.findOne({ _id: req.body.id });
  currency.name = currency_name;
  currency.code = currency_code;
  if (req.files.length > 0) {
    currency.image = req.files[0].path || null;
  }
  try {
    await currency.save();
    return res.json({
      status: 1,
      message: "Currency Updated successfully!",
      id: currency._id
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
