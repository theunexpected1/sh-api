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

const RoomName = require("../../db/models/roomnames");

router.get("/", async (req, res) => {
  let roomNames = await RoomName.find();
  let data = {
    roomNames: roomNames
  };
  res.render("admin/roomnames/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/roomnames");
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
  let room_name = req.body.room_name;
  if (!room_name) {
    return res.json({ status: 0, message: "Room Name is required" });
  }
  let roomname = new RoomName();
  roomname.name = room_name;
  if (req.files.length>0) {
    // let app_url = req.headers.origin;
    // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    // request(app_url+"/"+req.files[0].path).pipe(resizer);
    roomname.image = req.files[0].path || null;
  }
  try {
    await roomname.save();
    return res.json({
      status: 1,
      message: "Room Name Added successfully!",
      id: roomname._id
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
  let roomname = await RoomName.findOne({ _id: id });
  if (roomname) {
    roomname.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete proeprty type!" });
  }
});
router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let roomname = await RoomName.findOne({ _id: id });
  if (roomname) {
    return res.json({ status: 1, data: roomname });
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
  let room_name = req.body.room_name;
  if (!room_name) {
    return res.json({ status: 0, message: "Room Name is required" });
  }
  let roomname = await RoomName.findOne({_id:req.body.id});
  roomname.name = room_name;
  if (req.files.length > 0) {
    // let app_url = req.headers.origin;
    // var resizer = sharp().resize(600).toFile(req.files[0].path, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    // request(app_url+"/"+req.files[0].path).pipe(resizer);
    roomname.image = req.files[0].path || null;
  }
  try {
    await roomname.save();
    return res.json({
      status: 1,
      message: "Property Type Updated successfully!",
      id: roomname._id
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
