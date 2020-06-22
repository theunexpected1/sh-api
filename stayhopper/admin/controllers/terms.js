const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");
const sharp = require('sharp');
const request = require('request');

const Term = require('../../db/models/terms');

router.get('/',async(req,res)=>{
    let terms = await Term.find();
    let data = {
      terms: terms
    };
    res.render("admin/terms/list", data);
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "public/img/term");
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
    let term_name = req.body.term;
    if (!term_name) {
      return res.json({ status: 0, message: "Terms is required" });
    }
    let term = new Term();
    term.value = term_name;
    if (req.files.length > 0) {
      // let app_url = req.headers.origin;
      // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
      // request(app_url+"/"+req.files[0].path).pipe(resizer);
      term.image = req.files[0].path || null;
    }
    try {
      await term.save();
      return res.json({
        status: 1,
        message: "Terms Added successfully!",
        id: term._id
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
    let term = await Term.findOne({ _id: id });
    if (term) {
      term.remove();
      return res.json({ status: 1, message: "Deleted successfully!" });
    } else {
      return res.json({ status: 0, message: "Could not delete Terms!" });
    }
  });
  
  router.get("/:id", async (req, res) => {
    let id = req.params.id;
    let term = await Term.findOne({ _id: id });
    if (term) {
      return res.json({ status: 1, data: term });
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
      let term_name = req.body.term;
      if (!term_name) {
        return res.json({ status: 0, message: "Terms is required" });
      }
      let term = await Term.findOne({_id:req.body.id});
      term.value = term_name;
      if (req.files.length > 0) {
        // let app_url = req.headers.origin;
        // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
        // request(app_url+"/"+req.files[0].path).pipe(resizer);
        term.image = req.files[0].path || null;
      }
      try {
        await term.save();
        return res.json({
          status: 1,
          message: "Terms Updated successfully!",
          id: term._id
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