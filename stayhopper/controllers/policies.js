const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const Policy = require('../db/models/policies');

router.get('/',async(req,res)=>{
    let policies = await Policy.find();
    let data = {
      policies: policies
    };
    res.render("policysettings/list", data);
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "public/img/policies");
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
    let policy_name = req.body.policy;
    if (!policy_name) {
      return res.json({ status: 0, message: "Policy is required" });
    }
    let policy = new Policy();
    policy.name = policy_name;
    if (req.files.length > 0) {
      policy.image = req.files[0].path || null;
    }
    try {
      await policy.save();
      return res.json({
        status: 1,
        message: "Policy Added successfully!",
        id: policy._id
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
    let policy = await Policy.findOne({ _id: id });
    if (policy) {
      policy.remove();
      return res.json({ status: 1, message: "Deleted successfully!" });
    } else {
      return res.json({ status: 0, message: "Could not delete Policy!" });
    }
  });
  
  router.get("/:id", async (req, res) => {
    let id = req.params.id;
    let policy = await Policy.findOne({ _id: id });
    if (policy) {
      return res.json({ status: 1, data: policy });
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
      let policy_name = req.body.policy;
      if (!policy_name) {
        return res.json({ status: 0, message: "Policy Name is required" });
      }
      let policy = await Policy.findOne({_id:req.body.id});
      policy.name = policy_name;
      if (req.files.length > 0) {
        policy.image = req.files[0].path || null;
      }
      try {
        await policy.save();
        return res.json({
          status: 1,
          message: "Policy Updated successfully!",
          id: policy._id
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