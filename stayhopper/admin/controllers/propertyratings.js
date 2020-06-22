const db = require("../../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();

const PropertyRating = require("../../db/models/propertyratings");

router.get("/", async (req, res) => {
  propertyRatings = await PropertyRating.find();
  let data = {
    propertyRatings: propertyRatings
  };
  res.render("admin/propertyratings/list", propertyRatings);
});

router.post("/", async (req, res) => {
  let property_rating = req.body.property_rating;
  let property_rating_value = req.body.property_rating_value;
  if(!property_rating){
    return res.json({ status: 0, message: "Property Rating is required!" });
  }
  if(!property_rating_value){
    return res.json({ status: 0, message: "Property Rating Value is required!" });
  }
  
  propRating = new PropertyRating();
  propRating.name = property_rating;
  propRating.value = property_rating_value;

  try {
    await propRating.save();
    return res.json({
      status: 1,
      message: "Property Rating Saved successfully!",
      id: propRating._id
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
  let property_rating = await PropertyRating.findOne({ _id: id });
  if (property_rating) {
    property_rating.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete proeprty Rating!" });
  }
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let property_rating = await PropertyRating.findOne({ _id: id });
  if (property_rating) {
    return res.json({ status: 1, data: property_rating });
  } else {
    return res.json({ status: 0, message: "No data" });
  }
});

router.post('/update',async(req,res)=>{
  let property_rating = req.body.property_rating;
  let property_rating_value = req.body.property_rating_value;
  if(!property_rating){
    return res.json({ status: 0, message: "Property Rating is required!" });
  }
  if(!property_rating_value){
    return res.json({ status: 0, message: "Property Rating Value is required!" });
  }

  let rating = await PropertyRating.findOne({_id:req.body.id});
  rating.name = property_rating;
  rating.value = property_rating_value;
  try {
    await rating.save();
    return res.json({
      status: 1,
      message: "Property Rating Updated successfully!",
      id: rating._id
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
