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
const _ = require("underscore");
const sharp = require('sharp');
const request = require('request');

const Property = require("../db/models/properties");
const Room = require("../db/models/rooms");

const propertiesCrump = require("../middleware/propertiesCrump");
const propertiesCrump2 = require("../middleware/propertiesCrump2");

router.get("/:id", propertiesCrump, paginate.middleware(10, 50), async (req, res) => {
  let property_id = req.params.id;
  let property = await Property.findOne({ _id: property_id })
    .populate("company")
    .populate("type")
    .populate("rating");
  let where = { property_id: property_id };
  const [rooms, itemCount, totalRooms] = await Promise.all([
    Room.find(where)
      .populate("room_type")
      .populate("room_name")
      .populate("bed_type")
      .populate("services")
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
    Room.find(where).count({}),
    Room.aggregate([
      {
        $match: { property_id: db.Types.ObjectId(property_id) }
      },
      {
        $group: {
          _id: "$property_id",
          totalRooms: { $sum: "$number_rooms" }
        }
      },
      { $limit: 1 }
    ])
  ]);
  totalRoom = 0;
  if (totalRooms.length > 0) {
    totalRoom = totalRooms[0].totalRooms;
  }
  // return res.json(totalRooms[0]);
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    property: property,
    rooms: rooms,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    pageCount: pageCount,
    itemCount: itemCount,
    search: req.query.search,
    totalRooms: totalRoom
  };
  // return res.json(data);
  res.render("photos/list", data);
});

router.get("/update/:id",propertiesCrump,async (req, res) => {
  let property_id = req.params.id;
  property = await Property.findOne({ _id: property_id });
  let data = {
    property: property,
    _: _
  };
  res.render("photos/inner", data);
});
router.get("/room/update/:id", propertiesCrump2, async (req, res) => {
  let room_id = req.params.id;
  room = await Room.findOne({ _id: room_id }).populate('room_name').populate('room_type');
  property = await Property.findOne({ _id: room.property_id });
  let data = {
    room: room,
    property: property,
    _: _
  };
  res.render("photos/roominner", data);
});
router.get("/new/:id", async (req, res) => {
  let property_id = req.params.id;
  property = await Property.findOne({ _id: property_id });
  let data = {
    property: property
  };
  res.render("photos/new", data);
});
router.get("/new/rooms/:id", async (req, res) => {
  let room = await Room.findOne({ _id: req.params.id });
  let data = {
    room: room
  };
  res.render("photos/newroom", data);
});
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/files/original/properties");
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    var filename = file.fieldname + "-" + Date.now() + ext;
    console.log(filename);
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
  }).array("file")
);

router.post("/upload/:id", async (req, res) => {
  featured = false;
  try {
    await upload(req, res);
  } catch (err) {
    return res.json({ status: "error", message: "File could not upload" });
  }
  let image = null;
  if (req.files) {
    let app_url = req.headers.origin;
    filename = path.basename(req.files[0].path);
    var resizer = sharp().resize(600).toFile('public/files/properties/'+filename, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    request(app_url+"/"+req.files[0].path).pipe(resizer);
    if(filename){
      image = 'public/files/properties/'+filename;
    }
    // image = req.files[0].path || null;
  }
  if (image) {
    let property_id = req.params.id;
    let property = await Property.findOne({ _id: property_id });
    if (property) {
      let images = property.images;
      let featured_images = property.featured;
      if((typeof featured_images != 'undefined' && featured_images.length <= 0) || typeof featured_images == 'undefined'){
        featured_images = [image]
        property.featured = featured_images;
        featured = true;
      }
      if (images) {
        images.push(image);
      } else {
        images = [image];
      }
      property.images = images;
      try {
        await property.save();
      } catch (err) {}
      res.json({ status: "ok", message: image,featured});
    } else {
      return res.json({ status: "error", message: "File could not upload" });
    }
  } else {
    return res.json({ status: "error", message: "File could not upload" });
  }
});

const storage2 = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/files/original/rooms");
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    var filename = file.fieldname + "-" + Date.now() + ext;
    console.log(filename);
    cb(null, filename);
  }
});

let upload2 = pify(
  multer({
    storage: storage2,
    fileFilter: function(req, file, callback) {
      var ext = path.extname(file.originalname);
      if (
        ext !== ".png" &&
        ext !== ".jpg" &&
        ext !== ".gif" &&
        ext !== ".jpeg"
      ) {
        return callback(new Error("Only images are allowed"));
      }
      callback(null, true);
    }
  }).array("file")
);

router.post("/room/upload/:id", async (req, res) => {
  let featured = false;
  try {
    await upload2(req, res);
  } catch (err) {
    return res.json({ status: "error", message: "File could not upload" });
  }
  let image = null;
  if (req.files) {
    let app_url = req.headers.origin;
    filename = path.basename(req.files[0].path);
    var resizer = sharp().resize(600).toFile('public/files/rooms/'+filename, (err, info) => { console.log('err: ', err); console.log('info: ', info); }); 
    request(app_url+"/"+req.files[0].path).pipe(resizer);
    if(filename){
      image = 'public/files/rooms/'+filename;
    }
    // image = req.files[0].path || null;
  }
  if(image){
    let room_id = req.params.id;
    let room = await Room.findOne({ _id: room_id });
    if (room) {
      let featured_images = room.featured;
      if((typeof featured_images != 'undefined' && featured_images.length <= 0) || typeof featured_images == 'undefined'){
        featured_images = [image]
        room.featured = featured_images;
        featured = true;
      }
      let images = room.images;
      if (images) {
        images.push(image);
      } else {
        images = [image];
      }
      room.images = images;
      try {
        await room.save();
      } catch (err) {}
      res.json({ status: "ok", message: image, featured});
    } else {
      return res.json({ status: "error", message: "File could not upload" });
    }
  }else{
    return res.json({ status: "error", message: "File could not upload" });
  }
});

router.post("/property/remove", async (req, res) => {
  let image = req.body.image;
  let id = req.body.id;
  if (id) {
    let property = await Property.findOne({ _id: id });
    if (property.images) {
      if (property.images.length > 0) {
        let index = null;
        images = property.images;
        images = _.without(images, image);
        property.images = images;
        try {
          await property.save();
          return res.json({
            status: 1,
            message: "Image deleted successfully!"
          });
        } catch (error) {
          return res.json({ status: 0, message: "Image could not delete!" });
        }
      } else {
        return res.json({ status: 0, message: "Image could not delete!" });
      }
    } else {
      return res.json({ status: 0, message: "Image could not delete!" });
    }
  } else {
    return res.json({ status: 0, message: "Image could not delete!" });
  }
});
router.post("/room/remove", async (req, res) => {
  let image = req.body.image;
  let id = req.body.id;
  if (id) {
    let room = await Room.findOne({ _id: id });
    if (room.images) {
      if (room.images.length > 0) {
        let index = null;
        images = room.images;
        images = _.without(images, image);
        room.images = images;
        try {
          await room.save();
          return res.json({
            status: 1,
            message: "Image deleted successfully!"
          });
        } catch (error) {
          return res.json({ status: 0, message: "Image could not delete!" });
        }
      } else {
        return res.json({ status: 0, message: "Image could not delete!" });
      }
    } else {
      return res.json({ status: 0, message: "Image could not delete!" });
    }
  } else {
    return res.json({ status: 0, message: "Image could not delete!" });
  }
});

router.post("/property/featured", async (req, res) => {
  let image = req.body.image;
  let id = req.body.id;
  if (id) {
    let property = await Property.findOne({ _id: id });
    let status = 1;
    let featured = [image];
    property.featured = featured;
    try {
      await property.save();
      let images = property.images;
      images = _.without(images, image);      
      images.unshift(image);
      property.images = images;
      await property.save();
      return res.json({
        status: status,
        message: "Featured image set successfully!"
      });
    } catch (error) {
      return res.json({
        status: 0,
        message: "Featured image could not update"
      });
    }
  } else {
    return res.json({ status: 0, message: "Some error occured!" });
  }
});

router.post("/room/featured", async (req, res) => {
  let image = req.body.image;
  let id = req.body.id;
  if (id) {
    let room = await Room.findOne({ _id: id });
    let status =1;
    let featured = [image];
    room.featured = featured;
    try {
      await room.save();
      let images = room.images;
      images = _.without(images, image);      
      images.unshift(image);
      room.images = images;
      await room.save();
      return res.json({
        status: status,
        message: "Featured image set successfully!"
      });
    } catch (error) {
      return res.json({
        status: 0,
        message: "Featured image could not update"
      });
    }
  } else {
    return res.json({ status: 0, message: "Some error occured!" });
  }
});
module.exports = router;
