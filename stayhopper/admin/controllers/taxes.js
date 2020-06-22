const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const Tax = require("../../db/models/taxes");

router.get("/", async (req, res) => {
  let taxes = await Tax.find();
  let data = {
    taxes: taxes
  };
  res.render("admin/taxes/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/taxes");
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
  let tax_name = req.body.tax;
  let tax_value = req.body.value;
  if (!tax_name) {
    return res.json({ status: 0, message: "Tax Name is required" });
  }
  if (!tax_value) {
    return res.json({ status: 0, message: "Tax value is required" });
  }
  let tax = new Tax();
  tax.name = tax_name;
  tax.value = tax_value;
  try {
    await tax.save();
    return res.json({
      status: 1,
      message: "Tax Added successfully!",
      id: tax._id
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
  let tax = await Tax.findOne({ _id: id });
  if (tax) {
    tax.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete Tax!" });
  }
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let tax = await Tax.findOne({ _id: id });
  if (tax) {
    return res.json({ status: 1, data: tax });
  } else {
    return res.json({ status: 0, message: "No data" });
  }
});

router.post("/update", async (req, res) => {
  let tax_name = req.body.tax;
  let tax_value = req.body.value;
  if (!tax_name) {
    return res.json({ status: 0, message: "Tax Name is required" });
  }
  if (!tax_value) {
    return res.json({ status: 0, message: "Tax value is required" });
  }
  let tax = await Tax.findOne({ _id: req.body.id });
  tax.name = tax_name;
  tax.value = tax_value;
  try {
    await tax.save();
    return res.json({
      status: 1,
      message: "Tax Updated successfully!",
      id: tax._id
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
