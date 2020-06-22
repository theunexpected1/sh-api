const db = require("../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const generator = require("generate-password");
const paginate = require("express-paginate");

const Property = require("../db/models/properties");
const Room = require("../db/models/rooms");
const HotelAdmin = require("../db/models/hoteladmins");
const PropertyTypes = require("../db/models/propertytypes");
const PropertyRatings = require("../db/models/propertyratings");
const Countries = require("../db/models/countries");
const UserBooking = require("../db/models/userbookings");
const City = require("../db/models/cities");
const path = require("path");

const propertiesCrump = require("../middleware/propertiesCrump");

const property_active_bookings = async property_id => {
  return await UserBooking.find({
    property: property_id,
    date_checkin: { $gte: new Date() }
  }).count();
};

// router.get("/", async (req, res) => {
//   let hoteladmins = await HotelAdmin.find();
//   let data = {
//     hoteladmins: hoteladmins
//   };
//   res.render("hoteladmins/list", data);
// });
// router.get("/:id", async (req, res) => {
//   let hoteladmin = await HotelAdmin.findOne({ _id: req.params.id }).populate({
//     path: "properties",
//     populate: [{ path: "type" }]
//   });
//   let data = {
//     hoteladmin: hoteladmin
//   };
//   res.render("hoteladmins/view", data);
// });
// router.post("/disable", async (req, res) => {
//   let hoteladmin = await HotelAdmin.findOne({ _id: req.body.id });
//   if (hoteladmin) {
//     let resp = {};
//     if (hoteladmin.status == true) {
//       console.log("1");
//       hoteladmin.status = false;
//       resp = { status: 1, message: "hotel admin disabled successfully!" };
//     } else {
//       console.log("2");
//       hoteladmin.status = true;
//       resp = { status: 1, message: "hotel admin enabled successfully!" };
//     }
//     try {
//       await hoteladmin.save();
//       return res.json(resp);
//     } catch (error) {
//       console.log(error);
//       return res.json({
//         status: 0,
//         message: "Some error occured! Please contact administrator"
//       });
//     }
//   }
//   return res.json({
//     status: 0,
//     message: "Some error occured! Please contact administrator"
//   });
// });

router.get("/addproperty/:id", propertiesCrump, async (req, res) => {
  let property_types = await PropertyTypes.find().sort({name:1});
  let property_rating = await PropertyRatings.find().sort({name:1});
  let countries = await Countries.find().sort({country:1});
  let cities = await City.find().sort({name:1});
  let data = {
    property_types,
    property_rating,
    countries,
    admin_id: req.params.id,
    cities
  };
  res.render("hoteladmins/addproperty", data);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/files/properties");
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});

let upload = pify(
  multer({ storage: storage }).fields([
    { name: "trade_licence_attachment" },
    { name: "passport_attachment" }
  ])
);

const createSchema = {
  name: joi
    .string()
    .min(3)
    .required(),
  type: joi
    .string()
    .min(8)
    .required(),
  rating: joi.string().required(),
  contact_person: joi.string().required(),
  legal_name: joi.string().required(),
  country: joi.string().required(),
  city: joi.string().required(),
  email: joi.string().required(),
  mobile: joi.string().required(),
  trade_licence_number: joi.string(),
  trade_licence_validity: joi.string()
};

router.post("/addproperty", async (req, res) => {
  let session = req.session;
  try {
    await upload(req, res);
  } catch (err) {
    return res.json({ status: 0, message: "Could not update" });
  }
  const valid = joi.validate(req.body, createSchema, {
    abortEarly: false,
    allowUnknown: true
  });
  if (!req.body.timeslots) {
    return res.json({ status: 0, message: "Required time slots required" });
  }
  var errors = [];
  if (valid.error) {
    errors = valid.error.details.map(error => {
      return error.message;
    });
  }
  if (errors.length > 0) {
    return res.status(200).json({ status: 0, errors: errors });
  }

  //save hotel admin
  var password = generator.generate({
    length: 10,
    numbers: true
  });
  let data = req.body;
  hoteladmin = null;
  try {
   hoteladmin = await HotelAdmin.findOne({_id:session._id});
  } catch (error) {
    console.log(error);
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }

  if (hoteladmin._id) {
    let property = new Property();
    let passport_attachment = null;
    let trade_licence_attachment = null;
    if (req.files.trade_licence_attachment) {
      trade_licence_attachment =
        req.files.trade_licence_attachment[0].path || null;
    }
    if (req.files.passport_attachment) {
      passport_attachment = req.files.passport_attachment[0].path || null;
    }
    property.company = hoteladmin._id;
    property.name = data.name;
    property.type = data.type;
    property.rating = data.rating;
    property.description = data.description;
    property.timeslots = data.timeslots;
    property.legal_name = data.legal_name1,
    property.trade_licence = {
      trade_licence_number: data.trade_licence_number,
      trade_licence_attachment: trade_licence_attachment,
      trade_licence_validity: data.trade_licence_validity,
      passport_attachment: passport_attachment
    };
    property.contactinfo = {
      contact_person: data.contact_person,
      legal_name: data.legal_name,
      country: data.country,
      city: data.city,
      address_1: data.address_1,
      address_2: data.address_2,
      location: data.location,
      latlng: [data.lat,data.lng],
      zip: data.zip,
      email: data.email,
      mobile: data.mobile,
      land_phone: data.land_phone,
      alt_land_phone: data.alt_land_phone
    };
    if(data.lng && data.lat){
      property.location = {
        type: "Point",
        coordinates: [data.lng,data.lat]
      }
    }
    try {
      await property.save();
      hoteladmin.properties.push(property._id);
      await hoteladmin.save();
      return res.json({
        status: 1,
        message: "Property details inserted successfully!",
        id: property._id
      });
    } catch (error) {
      console.log(error);
      var errors = [];
      for (field in error.errors) {
        errors.push(error.errors[field].message);
      }
      return res.json({ status: 0, errors: errors });
    }
  } else {
    return res.json({
      status: 0,
      message: "Property details could not register successfully!"
    });
  }
});

router.post("/check_active_bookings",async(req,res)=>{
  hoteladmin_id = req.body.hoteladmin_id;
  let count = 0;
  if(hoteladmin_id){
    hoteladmin = await HotelAdmin.findOne({_id:hoteladmin_id});
    if(hoteladmin){
      properties = await Property.find({ company: hoteladmin._id });
      if (properties) {
        for (var i = 0; i < properties.length; i++) {
          let tmp  = await property_active_bookings(properties[i]._id);
          if(tmp){
            count = tmp;
          }
        }
      }
    }
  }
  return res.json({status:1,count:count});
})

router.get("/delete/:id", async (req, res) => {
  let company_id = req.params.id;
  if (company_id) {
    try {
      let hoteladmin = await HotelAdmin.findOne({ _id: company_id });
      if (hoteladmin) {
        properties = await Property.find({ company: hoteladmin._id });
        let count = 0;
        if (properties) {
          for (var i = 0; i < properties.length; i++) {
            let tmp  = await property_active_bookings(properties[i]._id);
            if(tmp){
              count = tmp;
            }
          }
        }
        if(!count){
          if (properties) {
            for (var i = 0; i < properties.length; i++) {
              await User.update(
                { favourites: db.Types.ObjectId(properties[i]._id)},
                { $pull: { 'favourites': db.Types.ObjectId(properties[i]._id)} }
              );
              await Room.deleteMany({ property_id: properties[i]._id });
            }
          }
          await Property.deleteMany({ company: hoteladmin._id });
          await HotelAdmin.deleteOne({ _id: hoteladmin._id });
        }
        return res.redirect("/hoteladmins/");
      } else {
        return res.redirect("/hoteladmins");
      }
    } catch (error) {
      return res.redirect("/hoteladmins");
    }
  } else {
    return res.redirect("/hoteladmins");
  }
});

router.get("/edit/:id", async (req, res) => {
  let countries = await Countries.find();
  let hoteladmin = await HotelAdmin.findOne({ _id: req.params.id });
  let cities = await City.find();
  let data = {
    countries,
    cities,
    admin: hoteladmin
  };
  res.render("hoteladmins/edit", data);
});

router.post("/update", async (req, res) => {
  let hoteladmin = await HotelAdmin.findOne({ _id: req.body.company_id });
  if (hoteladmin) {
    let data = req.body;
    hoteladmin.contact_person = data.contact_person;
    hoteladmin.legal_name = data.legal_name;
    hoteladmin.country = data.country;
    hoteladmin.city = data.city;
    hoteladmin.address_1 = data.address_1;
    hoteladmin.address_2 = data.address_2;
    hoteladmin.location = data.location;
    hoteladmin.latlng = data.latlng.split(",");
    hoteladmin.zip = data.zip;
    hoteladmin.email = data.email;
    hoteladmin.mobile = data.mobile;
    hoteladmin.land_phone = data.land_phone;
    hoteladmin.alt_land_phone = data.alt_land_phone;
    try {
      await hoteladmin.save();
      return res.json({ status: 1, message: "updated successfully!" });
    } catch (error) {
      var errors = [];
      for (field in error.errors) {
        errors.push(error.errors[field].message);
      }
      return res.json({ status: 0, errors: errors });
    }
  } else {
    return res.json({ status: 0, message: "Could not update" });
  }
});

module.exports = router;
