const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const sharp = require('sharp');
const request = require('request');

const Service = require('../../db/models/services');

router.get('/',async(req,res)=>{
    let services = await Service.find();
    let data = {
        services: services
    };
    res.render("admin/services/list", data);
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "public/img/services");
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
        console.log({ext});
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
    let service_name = req.body.service;
    if (!service_name) {
      return res.json({ status: 0, message: "Service Name is required" });
    }
    let service = new Service();
    service.name = service_name;
    if (req.files.length > 0) {
      // let app_url = req.headers.origin;
      // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
      // request(app_url+"/"+req.files[0].path).pipe(resizer);
      service.image = req.files[0].path || null;
    }
    try {
      await service.save();
      return res.json({
        status: 1,
        message: "Service Added successfully!",
        id: service._id
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
    let service = await Service.findOne({ _id: id });
    if (service) {
        service.remove();
      return res.json({ status: 1, message: "Deleted successfully!" });
    } else {
      return res.json({ status: 0, message: "Could not delete Service!" });
    }
  });
  
  router.get("/:id", async (req, res) => {
    let id = req.params.id;
    let service = await Service.findOne({ _id: id });
    if (service) {
      return res.json({ status: 1, data: service });
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
      let service_name = req.body.service;
      if (!service_name) {
        return res.json({ status: 0, message: "Service Name is required" });
      }
      let service = await Service.findOne({_id:req.body.id});
      service.name = service_name;
      if (req.files.length > 0) {
        // let app_url = req.headers.origin;
        // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
        // request(app_url+"/"+req.files[0].path).pipe(resizer);
        service.image = req.files[0].path || null;
      }
      try {
        await service.save();
        return res.json({
          status: 1,
          message: "Service Updated successfully!",
          id: service._id
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