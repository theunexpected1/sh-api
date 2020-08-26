const db = require("../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const RoomType = require("../db/models/roomtypes");

router.get("/", async (req, res) => {
  let roomTypes = await RoomType.find();
  let data = {
    roomTypes: roomTypes
  };
  res.render("roomtypes/list", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/img/roomtypes");
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
  let room_type = req.body.room_type;
  if (!room_type) {
    return res.json({ status: 0, message: "Room Type is required" });
  }
  let roomtype = new RoomType();
  roomtype.name = room_type;
  if (req.files.length>0) {
    roomtype.image = req.files[0].path || null;
  }
  try {
    await roomtype.save();
    return res.json({
      status: 1,
      message: "Room Type Added successfully!",
      id: roomtype._id
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
  let roomtype = await RoomType.findOne({ _id: id });
  if (roomtype) {
    roomtype.remove();
    return res.json({ status: 1, message: "Deleted successfully!" });
  } else {
    return res.json({ status: 0, message: "Could not delete proeprty type!" });
  }
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let roomtype = await RoomType.findOne({ _id: id });
  if (roomtype) {
    return res.json({ status: 1, data: roomtype });
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
  let room_type = req.body.room_type;
  if (!room_type) {
    return res.json({ status: 1, message: "Room Type is required" });
  }
  let roomtype = await RoomType.findOne({_id:req.body.id});
  roomtype.name = room_type;
  if (req.files.length > 0) {
    roomtype.image = req.files[0].path || null;
  }
  try {
    await roomtype.save();
    return res.json({
      status: 1,
      message: "Property Type Updated successfully!",
      id: roomtype._id
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
