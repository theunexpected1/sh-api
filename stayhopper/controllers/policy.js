const db = require("../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const generator = require("generate-password");
const path = require("path");
const paginate = require("express-paginate");

const Property = require("../db/models/properties");
const Policy = require("../db/models/policies");
const Term = require("../db/models/terms");

const propertiesCrump = require("../middleware/propertiesCrump");

router.get("/:id",propertiesCrump,async (req, res) => {
  let property_id = req.params.id;
  let property = await Property.findOne({ _id: property_id })
    .populate("terms")
    .populate("policies");
  let data = {
    property_id: property_id,
    property: property
  };
// return res.json(property);
  res.render("policies/list", data);
});

router.get("/update/:id",propertiesCrump,async (req, res) => {
  let property_id = req.params.id;
  property = await Property.findOne({ _id: property_id });
  let policies = await Policy.find();
  let terms = await Term.find();
  let data = {
    policies: policies,
    terms: terms,
    property_id: property._id
  };
  //   return res.json(data);
  res.render("policies/update", data);
});

router.post("/update", async (req, res) => {
  policies = req.body.policies;
  terms = req.body.terms;
  error = [];
  if (!policies) {
    error.push("Atleast one policy required");
  }
  if (!terms) {
    error.push("Atleast one term required");
  }
  if (error.length > 0) {
    return res.json({ status: 0, errors: error });
  }
  property_id = req.body.property_id;
  property = await Property.findOne({ _id: property_id });
  if (property) {
    property.policies = policies;
    property.terms = terms;
    try {
      await property.save();
      return res.json({ status: 1, message: "policies updated successfully!" });
    } catch (error) {
      return res.json({ status: 0, message: "Could not update policies" });
    }
  } else {
    return res.json({ status: 0, message: "Could not update policies" });
  }
});

module.exports = router;
