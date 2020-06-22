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
const Currency = require("../db/models/currencies");
const City = require("../db/models/cities");
const UserBooking = require("../db/models/userbookings");

const path = require("path");
const _ = require("underscore");

const propertiesCrump = require("../middleware/propertiesCrump");

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

const property_active_bookings = async property_id => {
  return await UserBooking.find({
    property: property_id
  }).count();
};

router.get("/", paginate.middleware(10, 50), async (req, res) => {
  let session = req.session;
  let active_page = 1;
  if(req.query.page){
    active_page = req.query.page;
  }
  let select_company = req.query.company;
  where = {};
  where.company = session._id;

  const [hoteladmins, properties, itemCount] = await Promise.all([
    HotelAdmin.find(),
    Property.find(where)
      .populate("company")
      .populate("type")
      .populate("rating")
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
    Property.find(where).count({})
  ]);
  try {
    for (var i = 0; i < properties.length; i++) {
      let rooms = await Room.aggregate([
        {
          $match: { property_id: db.Types.ObjectId(properties[i]._id) }
        },
        {
          $group: {
            _id: "$property_id",
            totalRooms: { $sum: "$number_rooms" }
          }
        },
        { $limit: 1 }
      ]);
      let total_rooms = 0;
      if (rooms.length > 0) {
        total_rooms = rooms[0].totalRooms;
      }
      properties[i].total_rooms = total_rooms;
    }
  } catch (error) {
    console.log(error);
  }
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    properties: properties,
    hoteladmins: hoteladmins,
    select_company: select_company,
    itemCount: itemCount,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    search: req.query.search,
    active_page
  };
  res.render("properties/list", data);
});

router.get("/new", propertiesCrump, async (req, res) => {
  let session = req.session;
  let admin_det = await HotelAdmin.findOne({_id:session._id})
  let property_types = await PropertyTypes.find().sort({name:1});
  let property_rating = await PropertyRatings.find().sort({name:1});
  let countries = await Countries.find().sort({country:1});
  let cities = await City.find().sort({name:1});
  let data = {
    property_types,
    property_rating,
    countries,
    admin_det,
    admin_id: session._id,
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

router.post("/", async (req, res) => {
  try {
    await upload(req, res);
  } catch (err) {
    return res.json({ status: 0, message: "Could not update" });
  }
  if (!req.body.timeslots) {
    return res.json({ status: 0, message: "Required time slots required" });
  }
  const valid = joi.validate(req.body, createSchema, {
    abortEarly: false,
    allowUnknown: true
  });
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
  let hoteladmin = new HotelAdmin();
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
  hoteladmin.password = password;
  try {
    await hoteladmin.save();
  } catch (error) {
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
      latlng: data.latlng.split(","),
      zip: data.zip,
      email: data.email,
      mobile: data.mobile,
      land_phone: data.land_phone,
      alt_land_phone: data.alt_land_phone
    };
    let loc_lat_lng = data.latlng.split(",");
    if(loc_lat_lng.length>1){
      let lng = loc_lat_lng[1];
      let lat = loc_lat_lng[0];
      property.location = {
        type: "Point",
        coordinates: [lng,lat]
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

router.post("/update", async (req, res) => {
  try {
    await upload(req, res);
  } catch (err) {
    return res.json({ status: 0, message: "Could not update" });
  }
  if (!req.body.timeslots) {
    return res.json({ status: 0, message: "Required time slots required" });
  }
  const valid = joi.validate(req.body, createSchema, {
    abortEarly: false,
    allowUnknown: true
  });
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
  let hoteladmin = await HotelAdmin.findOne({ _id: data.company_id });
  if (!hoteladmin) {
    return res.json({ status: 0, message: "Could not update!" });
  }
  if (hoteladmin._id) {
    let property = await Property.findOne({ _id: data.property_id });
    if (!property) {
      return res.json({ status: 0, message: "Could not update!" });
    }
    property.trade_licence.trade_licence_number = data.trade_licence_number;
    property.trade_licence.trade_licence_validity = data.trade_licence_validity;

    if (req.files.trade_licence_attachment) {
      property.trade_licence.trade_licence_attachment =
        req.files.trade_licence_attachment[0].path || null;
    }
    if (req.files.passport_attachment) {
      property.trade_licence.passport_attachment =
        req.files.passport_attachment[0].path || null;
    }
    property.company = hoteladmin._id;
    property.name = data.name;
    property.type = data.type;
    property.rating = data.rating;
    property.description = data.description;
    property.timeslots = data.timeslots;
    property.legal_name = data.legal_name1,
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
    if(data.lat && data.lng){
      property.location = {
        type: "Point",
        coordinates: [data.lng,data.lat]
      }
    }
    try {
      await property.save();
      return res.json({
        status: 1,
        message: "Property details updated successfully!",
        id:property._id
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
      message: "Property details could not register!"
    });
  }
});

router.get("/edit/:id", propertiesCrump, async (req, res) => {
  let property_types = await PropertyTypes.find().sort({name:1});
  let property_rating = await PropertyRatings.find().sort({name:1});
  let countries = await Countries.find().sort({country:1});
  let cities = await City.find().sort({name:1});
  let property_id = req.params.id;
  let property = await Property.findOne({ _id: property_id }).populate(
    "company"
  );
  let timeslots = {};
  if (property.timeslots) {
    timeslots = property.timeslots;
  }
  let data = {
    property_types: property_types,
    property_rating: property_rating,
    countries: countries,
    property: property,
    cities: cities,
    timeslots: timeslots,
    _: _
  };
  // return res.json(property);
  res.render("properties/edit", data);
});

router.post("/check_active_bookings",async(req,res)=>{
  let count = await property_active_bookings(req.body.property_id);
  return res.json({status:1,count:count});
})

router.get("/delete/:id", async (req, res) => {
  let property_id = req.params.id;
  if (property_id) {
    try {
      let property = await Property.findOne({ _id: property_id });
      if (property) {
        let has_active_bookings = await property_active_bookings(property_id);
        if (!has_active_bookings) {
          let hoteladmin = await HotelAdmin.findOne({ _id: property.company });
          await Room.deleteMany({ property_id: property_id });
          await Property.deleteOne({ _id: property_id });
          await User.update(
            { favourites: db.Types.ObjectId(property_id)},
            { $pull: { 'favourites': db.Types.ObjectId(property_id)} }
          );
          if (hoteladmin) {
            let properties = hoteladmin.properties;
            let new_properties = []
            for(var i=0;i<properties.length;i++){
              if(properties[i].toString() != property_id){
                new_properties.push(properties[i]);
              }
            }
            hoteladmin.properties = new_properties;
            await hoteladmin.save();
            return res.redirect("/properties/");
          }
        }else{
          return res.redirect("/properties");
        }
      } else {
        return res.redirect("/properties");
      }
    } catch (error) {
      return res.redirect("/properties");
    }
  } else {
    return res.redirect("/properties");
  }
});

router.get("/view/:id", async (req, res) => {
  let property = await Property.findOne({ _id: req.params.id })
    .populate({
      path: "rooms",
      populate: [{ path: "room_type" }, { path: "services" }]
    })
    .populate("policies")
    .populate("terms")
    .populate("rating");  
  let data = {
    property,
    _,
  };
  // return res.json(property);
  res.render("properties/view.ejs", data);
});

router.post("/approved", async (req, res) => {
  let id = req.body.id;
  if (id) {
    let property = await Property.findOne({ _id: id });
    if (property) {
      let status = 1;
      if (property.published == true) {
        property.published = false;
        status = 2;
      } else {
        property.published = true;
        status = 1;
      }
      await property.save();
      return res.json({ status: status, message: "updated" });
    } else {
      return res.json({ status: 0, message: "Could not update" });
    }
  } else {
    return res.json({ status: 0, message: "Could not update" });
  }
});
module.exports = router;
