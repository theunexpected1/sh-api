const db = require("../../db/mongodb");
const config = require("config");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const generator = require("generate-password");
const paginate = require("express-paginate");
const ejs = require('ejs')
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const url = require('url') ;


const Property = require("../../db/models/properties");
const Room = require("../../db/models/rooms");
const HotelAdmin = require("../../db/models/hoteladmins");
const PropertyTypes = require("../../db/models/propertytypes");
const PropertyRatings = require("../../db/models/propertyratings");
const Countries = require("../../db/models/countries");
const UserBooking = require("../../db/models/userbookings");
const City = require("../../db/models/cities");
const path = require("path");

const propertiesCrump = require("../../middleware/propertiesCrump");

const property_active_bookings = async property_id => {
  return await UserBooking.find({
    property: property_id,
    date_checkin: { $gte: new Date() }
  }).count();
};

router.get("/", paginate.middleware(10, 50), async (req, res) => {
  let = 1;
  if (req.query.page) {
    active_page = req.query.page;
  }
  let hoteladmins = await HotelAdmin.find()
    .limit(req.query.limit)
    .skip(req.skip)
    .lean()
    .exec();
  itemCount = await HotelAdmin.find().count();
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    hoteladmins: hoteladmins,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    active_page
  };
  res.render("admin/hoteladmins/list", data);
});
router.get("/:id", async (req, res) => {
  let hoteladmin = await HotelAdmin.findOne({ _id: req.params.id }).populate({
    path: "properties",
    populate: [{ path: "type" }]
  });
  let data = {
    hoteladmin: hoteladmin
  };
  res.render("admin/hoteladmins/view", data);
});
router.post("/disable", async (req, res) => {
  let hoteladmin = await HotelAdmin.findOne({ _id: req.body.id });
  if (hoteladmin) {
    let resp = {};
    if (hoteladmin.status == true) {
      console.log("1");
      hoteladmin.status = false;
      resp = { status: 1, message: "hotel admin disabled successfully!" };
    } else {
      console.log("2");
      hoteladmin.status = true;
      resp = { status: 1, message: "hotel admin enabled successfully!" };
    }
    try {
      await hoteladmin.save();
      return res.json(resp);
    } catch (error) {
      console.log(error);
      return res.json({
        status: 0,
        message: "Some error occured! Please contact administrator"
      });
    }
  }
  return res.json({
    status: 0,
    message: "Some error occured! Please contact administrator"
  });
});

router.get("/addproperty/:id", propertiesCrump, async (req, res) => {
  let hoteladmin = await HotelAdmin.findOne({ _id: req.params.id });
  let property_types = await PropertyTypes.find().sort({name:1});
  let property_rating = await PropertyRatings.find().sort({name:1});
  let countries = await Countries.find().sort({country:1});
  let cities = await City.find().sort({name:1});
  let data = {
    hoteladmin,
    property_types,
    property_rating,
    countries,
    admin_id: req.params.id,
    cities
  };
  res.render("admin/hoteladmins/addproperty", data);
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
  let hoteladmin = null;
  let data = req.body;
  console.log(data)
  try {
    hoteladmin = await HotelAdmin.findOne({ _id: req.body.admin_id });
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
      latlng: [data.lat, data.lng],
      zip: data.zip,
      email: data.email,
      mobile: data.mobile,
      land_phone: data.land_phone,
      alt_land_phone: data.alt_land_phone
    };
    if (data.lat && data.lng) {
      property.location = {
        type: "Point",
        coordinates: [data.lng, data.lat]
      };
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

router.post("/check_active_bookings", async (req, res) => {
  hoteladmin_id = req.body.hoteladmin_id;
  let count = 0;
  if (hoteladmin_id) {
    hoteladmin = await HotelAdmin.findOne({ _id: hoteladmin_id });
    if (hoteladmin) {
      properties = await Property.find({ company: hoteladmin._id });
      if (properties) {
        for (var i = 0; i < properties.length; i++) {
          let tmp = await property_active_bookings(properties[i]._id);
          if (tmp) {
            count = tmp;
          }
        }
      }
    }
  }
  return res.json({ status: 1, count: count });
});

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
            let tmp = await property_active_bookings(properties[i]._id);
            if (tmp) {
              count = tmp;
            }
          }
        }
        if (!count) {
          if (properties) {
            for (var i = 0; i < properties.length; i++) {
              await User.update(
                { favourites: db.Types.ObjectId(properties[i]._id) },
                { $pull: { 'favourites': db.Types.ObjectId(properties[i]._id) } }
              );
              await Room.deleteMany({ property_id: properties[i]._id });
            }
          }
          await Property.deleteMany({ company: hoteladmin._id });
          await HotelAdmin.deleteOne({ _id: hoteladmin._id });
        }
        return res.redirect("/admin/hoteladmins/");
      } else {
        return res.redirect("/admin/hoteladmins");
      }
    } catch (error) {
      return res.redirect("/admin/hoteladmins");
    }
  } else {
    return res.redirect("/admin/hoteladmins");
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
  res.render("admin/hoteladmins/edit", data);
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
    if (data.email && data.email != hoteladmin.email) {
      let email_exists = await HotelAdmin.find({ email: data.email }).count();
      if (email_exists) {
        return res.json({ status: 0, message: "Email ID already exists" });
      }
    }
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

router.get("/admin/new", async (req, res) => {
  let countries = await Countries.find();
  let cities = await City.find();
  let data = {
    countries,
    cities
  };
  res.render("admin/hoteladmins/new", data);
});

router.post("/admin/new", async (req, res) => {
  var logo = req.protocol + '://' + req.get('host') + '/public/img/StayhopperLogoRedWHite.png';
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
  var password = generator.generate({
    length: 10,
    numbers: true
  });
  hoteladmin.password = await bcrypt.hashSync(password, 10);

  if (data.email) {
    let email_exists = await HotelAdmin.find({ email: data.email }).count();
    console.log({ email_exists });
    if (email_exists > 0) {
      return res.json({ status: 0, message: "Email ID already exists" });
    }
  }
  try {
    await hoteladmin.save();
    return res.json({ status: 1, message: "Saved successfully!" });
  } catch (error) {
    console.log(error);
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }
});

router.get('/welcomemail/send', async (req, res) => {
  let app_url = config.app_url;
  let admin_id = req.query.id;
  hoteladmin = await HotelAdmin.findOne({
    _id:admin_id
  }) 
  if(!hoteladmin){
    return res.json({
      status:0,message:'Welcome message send successfully!'
    });
  }
  var password = generator.generate({
    length: 10,
    numbers: true
  });
  hoteladmin.password = await bcrypt.hashSync(password, 10);
  await hoteladmin.save();

  let html_body = `
  <html xmlns="http://www.w3.org/1999/xhtml" style="min-width: 100%;margin: 0;padding: 0;-webkit-text-size-adjust: 100%;-ms-text-size-adjust: 100%;background-color: #d8dde4;width: 100% !important;"><head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no">
            <!--[if !mso]><!-->
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <!--<![endif]-->
                <title></title>
                <style type="text/css">/* Reset */
                    table, td, div {
                        box-sizing: border-box; }

                    html,
                    body {
                        width: 100% !important;
                        min-width: 100%;
                        Margin: 0;
                        padding: 0;
                        -webkit-text-size-adjust: 100%;
                        -ms-text-size-adjust: 100%; }

                    .email_body td, .email_body div, .email_body a, .email_body span {
                        line-height: inherit; }

                    a,
                    a:visited,
                    a span {
                        text-decoration: none; }

                    #outlook a {
                        padding: 0; }

                    img {
                        outline: none;
                        border: 0;
                        text-decoration: none;
                        -ms-interpolation-mode: bicubic;
                        clear: both;
                        line-height: 100%; }

                    table {
                        border-spacing: 0;
                        mso-table-lspace: 0pt;
                        mso-table-rspace: 0pt; }

                    td {
                        vertical-align: top; }

                    /* Grid */
                    .email_table,
                    .content_section,
                    .column,
                    .column_cell {
                        width: 100%;
                        min-width: 100%; }

                    .email_body {
                        font-size: 0 !important;
                        line-height: 100%;
                        text-align: center;
                        padding-left: 16px;
                        padding-right: 16px; }

                    .email_start {
                        padding-top: 32px; }

                    .email_end {
                        padding-bottom: 32px; }

                    .email_body,
                    html,
                    body {
                        background-color: #d8dde4; }

                    .email_container,
                    .email_row,
                    .col_0,
                    .col_1,
                    .col_2,
                    .col_3,
                    .col_4,
                    .col_5,
                    .col_6,
                    .col_2_lg {
                        font-size: 0;
                        display: inline-block;
                        width: 100%;
                        min-width: 100%;
                        min-width: 0 !important;
                        vertical-align: top; }

                    .content_cell {
                        width: 100%;
                        min-width: 100%;
                        min-width: 0 !important; }

                    .column_cell {
                        padding-top: 16px;
                        padding-bottom: 16px;
                        vertical-align: top; }

                    .email_container {
                        max-width: 632px;
                        Margin: 0 auto;
                        text-align: center; }

                    .email_row {
                        display: block;
                        max-width: 600px !important;
                        Margin: 0 auto;
                        text-align: center;
                        clear: both; }

                    .col_0 {
                        max-width: 50px; }

                    .col_1 {
                        max-width: 100px; }

                    .col_2 {
                        max-width: 200px; }

                    .col_3 {
                        max-width: 300px; }

                    .col_4 {
                        max-width: 400px; }

                    .col_5 {
                        max-width: 500px; }

                    .col_6 {
                        max-width: 600px; }

                    .col_2_lg {
                        max-width: 400px; }

                    .col_center {
                        display: block;
                        margin-left: auto;
                        margin-right: auto; }

                    .email_body a,
                    .email_body a span {
                        text-decoration: none;
                        color: #35bec5; }

                    .email_body a.td,
                    .email_body a.td span {
                        color: #888888; }

                    .column_cell,
                    .column_cell td,
                    .xlabel_c,
                    p {
                        font-family: Helvetica, Arial, sans-serif; }

                    .email_body .column_cell,
                    .column_cell,
                    .min_table td,
                    .xlabel_c,
                    p {
                        font-size: 16px;
                        line-height: 23px;
                        color: #888888;
                        mso-line-height-rule: exactly; }

                    p {
                        display: block;
                        Margin-top: 0;
                        Margin-bottom: 16px; }
                    p small {
                        font-size: 14px; }
                    p.lead {
                        font-size: 19px;
                        line-height: 27px;
                        color: #a9b3ba; }

                    .small {
                        font-size: 14px;
                        line-height: 20px; }

                    h1, h2, h3, h4, h5, h6 {
                        color: #383d42;
                        Margin-left: 0;
                        Margin-right: 0;
                        Margin-top: 20px;
                        Margin-bottom: 8px;
                        padding: 0;
                        font-weight: bold; }

                    h1 a, h2 a, h3 a, h4 a, h5 a, h6 a,
                    h1 a span, h2 a span, h3 a span, h4 a span, h5 a span, h6 a span {
                        color: #383d42; }

                    h1 {
                        font-size: 32px;
                        line-height: 42px; }

                    h2 {
                        font-size: 26px;
                        line-height: 36px; }

                    h3 {
                        font-size: 23px;
                        line-height: 30px; }

                    h4 {
                        font-size: 19px;
                        line-height: 25px; }

                    h5 {
                        font-size: 16px;
                        line-height: 21px; }

                    h6 {
                        font-size: 13px;
                        line-height: 20px; }

                    .footer_c .column_cell,
                    .footer_c p {
                        color: #a9b3ba; }

                    .footer_c a,
                    .footer_c a span {
                        color: #a9b3ba;
                        text-decoration: underline; }

                    .content_cell,
                    .bank_cell {
                        width: 100%;
                        font-size: 0;
                        text-align: center;
                        vertical-align: top;
                        padding-left: 16px;
                        padding-right: 16px; }

                    .content_cell {
                        background-color: #ffffff; }

                    .hdr_menu {
                        text-align: right; }
                    .hdr_menu p {
                        line-height: 100%; }

                    .email_body .logo_c {
                        line-height: 100%; }

                    .logo_c img {
                        max-width: 168px;
                        height: auto !important; }

                    .email_body .fsocial {
                        line-height: 100%;
                        color: #a9b3ba; }

                    .fsocial img {
                        max-width: 24px;
                        height: auto !important; }

                    .ncard_c {
                        color: #888888;
                        overflow: hidden; }

                    .content_cell .sc,
                    .sc td,
                    .sc {
                        color: #ffffff; }

                    .sc h1,
                    .sc h2,
                    .sc h3,
                    .sc h4,
                    .sc h5,
                    .sc h6,
                    .sc p,
                    .sc a,
                    .sc a span {
                        color: #ffffff; }

                    .hr_rl,
                    .hr_ep {
                        font-size: 0;
                        line-height: 1px;
                        mso-line-height-rule: exactly;
                        min-height: 1px;
                        overflow: hidden;
                        height: 2px;
                        background-color: transparent !important; }

                    .default_b {
                        background-color: #102579; }

                    .active_b {
                        background-color: #35bec5; }

                    .success_b {
                        background-color: #3fdb98; }

                    .danger_b {
                        background-color: #d46377; }

                    .warning_b {
                        background-color: #edb476; }

                    .light_b {
                        background-color: #f2f2f5; }

                    .imgr {
                        clear: both;
                        font-size: 0;
                        line-height: 100%; }
                    .imgr a,
                    .imgr a span {
                        line-height: 1; }

                    .imgr img {
                        width: 100% !important;
                        max-width: 568px;
                        height: auto !important; }

                    .imgr24 img {
                        max-width: 24px; }

                    .imgr44 img {
                        max-width: 44px; }

                    .imgr68 img {
                        max-width: 68px; }

                    .imgr96 img {
                        max-width: 96px; }

                    .imgr168 img {
                        max-width: 168px; }

                    .imgr268 img {
                        max-width: 268px; }

                    .imgr632 img {
                        max-width: 632px; }

                    .ebtn,
                    .ebtn_xs,
                    .ic_h {
                        display: table;
                        margin-left: auto;
                        margin-right: auto; }

                    .ebtn td,
                    .ebtn_xs td {
                        line-height: 20px;
                        mso-line-height-rule: exactly;
                        border-radius: 4px;
                        text-align: center;
                        font-weight: bold; }
                    .ebtn td a,
                    .ebtn td a span,
                    .ebtn_xs td a,
                    .ebtn_xs td a span {
                        color: #ffffff; }

                    .ebtn td {
                        font-size: 17px;
                        padding: 13px 22px; }

                    .ebtn_xs td {
                        border-radius: 4px;
                        font-size: 14px;
                        padding: 8px 16px; }

                    .ic_h {
                        width: 64px; }
                    .ic_h img {
                        max-width: 32px;
                        width: 32px;
                        height: 32px;
                        display: block;
                        line-height: 100%; }
                    .ic_h a {
                        line-height: 100%; }
                    .ic_h td {
                        text-align: center;
                        vertical-align: middle;
                        line-height: 100%;
                        mso-line-height-rule: exactly;
                        padding: 16px;
                        border-radius: 80px; }

                    .email_summary {
                        display: none;
                        font-size: 1px;
                        line-height: 1px;
                        max-height: 0px;
                        max-width: 0px;
                        opacity: 0;
                        overflow: hidden; }

                    p.small {
                        display: block; }

                    .brt {
                        border-radius: 4px 4px 0 0; }

                    .brb {
                        border-radius: 0 0 4px 4px; }

                    .bra {
                        border-radius: 4px; }

                    .braf {
                        border-radius: 200px; }

                    .brl {
                        -webkit-border-radius: 4px 0 0 4px;
                        border-radius: 4px 0 0 4px; }

                    .brr {
                        -webkit-border-radius: 0 4px 4px 0;
                        border-radius: 0 4px 4px 0; }

                    .ncard_c {
                        border-radius: 4px; }

                    .tp,
                    table .tp {
                        color: #35bec5; }

                    .ts,
                    table .ts {
                        color: #3fdb98; }

                    .tde,
                    table .tde {
                        color: #d46377; }

                    .tm,
                    table .tm,
                    a.tm,
                    a.tm span {
                        color: #a9b3ba; }

                    .td,
                    table .td {
                        color: #888888; }

                    .tc {
                        text-align: center; }

                    .tc .imgr img {
                        margin-left: auto;
                        margin-right: auto; }

                    .tl {
                        text-align: left; }

                    table.tl {
                        margin-left: 0;
                        margin-right: auto; }

                    .tr {
                        text-align: right; }

                    table.tr {
                        margin-left: auto;
                        margin-right: 0; }

                    .nw,
                    table .nw {
                        white-space: nowrap; }

                    .py {
                        padding-top: 16px;
                        padding-bottom: 16px; }

                    .px {
                        padding-left: 16px;
                        padding-right: 16px; }

                    .pt {
                        padding-top: 16px; }

                    .pt_0 {
                        padding-top: 0; }

                    .pt_xs {
                        padding-top: 8px; }

                    .pte {
                        padding-top: 32px; }

                    .pt_card {
                        padding-top: 96px; }

                    .pb {
                        padding-bottom: 16px; }

                    .pb_0 {
                        padding-bottom: 0; }

                    .pb_xs {
                        padding-bottom: 8px; }

                    .pbe {
                        padding-bottom: 32px; }

                    .xlabel .pl_0,
                    .pl_0 {
                        padding-left: 0; }

                    .pl {
                        padding-left: 16px; }

                    .ple {
                        padding-left: 32px; }

                    .xlabel .pr_0,
                    .pr_0 {
                        padding-right: 0; }

                    .pr {
                        padding-right: 16px; }

                    .pre {
                        padding-right: 32px; }

                    .pte_lg {
                        padding-top: 64px; }

                    .mt_0 {
                        margin-top: 0; }

                    .mt_xs {
                        margin-top: 8px; }

                    .mt {
                        margin-top: 16px; }

                    .mte {
                        margin-top: 32px; }

                    .mb_0 {
                        margin-bottom: 0; }

                    .mb_xs {
                        margin-bottom: 8px; }

                    .mb_xxs {
                        margin-bottom: 4px; }

                    .mb {
                        margin-bottom: 16px; }

                    .mbe {
                        margin-bottom: 32px; }

                    .bt {
                        border-top: 1px solid #d8dde4; }

                    .bb {
                        border-bottom: 1px solid #d8dde4; }

                    .btw,
                    .bt.btw,
                    .bbw.btw {
                        border-color: #ffffff; }

                    .clear {
                        content: ' ';
                        display: block;
                        clear: both;
                        height: 1px;
                        overflow: hidden;
                        font-size: 0; }

                    @media only screen {
                        /* latin */
                        @font-face {
                            font-family: 'Roboto';
                            font-style: normal;
                            font-weight: 400;
                            src: local("Roboto"), local("Roboto-Regular"), url(https://fonts.gstatic.com/s/roboto/v15/CWB0XYA8bzo0kSThX0UTuA.woff2) format("woff2");
                            unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215; }
                        /* latin */
                        @font-face {
                            font-family: 'Roboto';
                            font-style: normal;
                            font-weight: 700;
                            src: local("Roboto Bold"), local("Roboto-Bold"), url(https://fonts.gstatic.com/s/roboto/v15/d-6IYplOFocCacKzxwXSOFtXRa8TVwTICgirnJhmVJw.woff2) format("woff2");
                            unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215; }
                        .column_cell,
                        .column_cell td,
                        .xlabel_c,
                        p {
                            font-family: "Roboto", sans-serif !important;
                            font-weight: 400; }
                        strong, b, h1, h2, h3, h4, h5 {
                            font-weight: 700; }
                        a {
                            display: inline-block; }
                        .ebtn td,
                        .ebtn_xs td {
                            padding: 0 !important;
                            -webkit-transition: box-shadow 0.25s;
                            -moz-transition: box-shadow 0.25s;
                            -ms-transition: box-shadow 0.25s;
                            -o-transition: box-shadow 0.25s;
                            transition: box-shadow 0.25s; }
                        .ebtn a,
                        .ebtn a span,
                        .ebtn_xs a,
                        .ebtn_xs a span {
                            display: block !important;
                            text-align: center !important;
                            vertical-align: top !important;
                            line-height: inherit !important; }
                        .ebtn a {
                            padding: 10px 35px !important;
                            line-height: 26px !important;
                            font-weight: 700 !important; }
                        .ebtn_xs a {
                            padding: 5px 16px !important;
                            line-height: 26px !important;
                            font-weight: 400 !important; } }

                    @media (max-width: 697px) {
                        .email_body.email_start {
                            padding-top: 16px !important; }
                        .email_body.email_end {
                            padding-bottom: 16px !important; }
                        .email_holder,
                        .email_container,
                        .col_1,
                        .col_2,
                        .col_3,
                        .col_4,
                        .col_5,
                        .col_6,
                        .col_2_lg {
                            width: 100% !important;
                            max-width: none !important; }
                        .hdr_menu {
                            text-align: left !important;
                            padding-top: 12px !important; }
                        .hdr_menu .ebtn,
                        .hdr_menu .ebtn_xs {
                            margin-right: auto !important;
                            margin-left: 0 !important; }
                        .pte_lg,
                        .py.pte_lg {
                            padding-top: 32px !important; }
                        .pte_xs,
                        .py.pte_xs {
                            padding-top: 8px !important; }
                        .pbe_xs,
                        .py.pbe_xs {
                            padding-bottom: 8px !important; }
                        .ord_cell,
                        .invoice_qty,
                        .invoice_price {
                            text-align: left !important; }
                        .ord_cell {
                            padding-top: 8px !important; }
                        .hide {
                            max-height: 0 !important;
                            display: none !important;
                            mso-hide: all !important;
                            overflow: hidden !important;
                            font-size: 0 !important; } }

                    @media only screen and (min-device-width: 768px) and (max-device-width: 1024px) and (orientation: landscape) {
                        body {
                            min-height: 1024px !important; } }
                        </style>

                        </head>
                        <body leftmargin="0" marginwidth="0" topmargin="0" marginheight="0" offset="0" style="min-width: 100%;margin: 0;padding: 0;-webkit-text-size-adjust: 100%;-ms-text-size-adjust: 100%;background-color: #d8dde4;width: 100% !important;">
                    <!-- header_accent_icons -->
                   <table class="email_table" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
    <tbody>
        <tr>
            <td class="email_body email_start tc" style="box-sizing: border-box;vertical-align: top;line-height: 100%;text-align: center;padding-left: 16px;padding-right: 16px;padding-top: 32px;background-color: #d8dde4;font-size: 0 !important;">
                <!--[if (mso)|(IE)]><table width="632" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:632px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                <div class="email_container" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 632px;margin: 0 auto;text-align: center;line-height: inherit;min-width: 0 !important;">
                    <table class="content_section" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                        <tbody>
                            <tr>
                                <td class="blank_cell header_c pt pb" style="box-sizing: border-box;vertical-align: top;padding-top: 16px;padding-bottom: 16px;line-height: inherit;">
                                    <!-- col-6 -->
                                    <div class="email_row" style="box-sizing: border-box;font-size: 0;display: block;width: 100%;vertical-align: top;margin: 0 auto;text-align: center;clear: both;line-height: inherit;min-width: 0 !important;max-width: 600px !important;">
                                    <!--[if (mso)|(IE)]><table width="600" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:600px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                                        <div class="col_6" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 600px;line-height: inherit;min-width: 0 !important;">
                                            <table class="column" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                                                <tbody>
                                                    <tr>
                                                        <td class="column_cell px pt_xs pb_0 logo_c tc" style="box-sizing: border-box;vertical-align: top;width: 100%;min-width: 100%;padding-top: 8px;padding-bottom: 0;font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 100%;color: #888888;mso-line-height-rule: exactly;text-align: center;padding-left: 16px;padding-right: 16px;"><a href="#" style="text-decoration: none;line-height: inherit;color: #35bec5;"><img src="http://extranet.stayhopper.com/public/mail/logo_dark.png" width="180"  alt="" style="outline: none;border: 0;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;line-height: 100%;max-width: 168px;height: auto !important;"></a></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
            </td>
        </tr>
    </tbody>
</table>
                    <table class="email_table" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
    <tbody>
        <tr>
            <td class="email_body tc" style="box-sizing: border-box;vertical-align: top;line-height: 100%;text-align: center;padding-left: 16px;padding-right: 16px;background-color: #d8dde4;font-size: 0 !important;">
                <!--[if (mso)|(IE)]><table width="632" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:632px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                <div class="email_container" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 632px;margin: 0 auto;text-align: center;line-height: inherit;min-width: 0 !important;">
                    <table class="content_section" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                        <tbody>
                            <tr>
                                <td class="content_cell pl_0 pr_0" style="box-sizing: border-box;vertical-align: top;width: 100%;background-color: #ffffff;font-size: 0;text-align: center;padding-left: 0;padding-right: 0;line-height: inherit;min-width: 0 !important;">
                                    <p class="mb_0 imgr imgr632" style="font-family: Helvetica, Arial, sans-serif;font-size: 0;line-height: 100%;color: #888888;mso-line-height-rule: exactly;display: block;margin-top: 0;margin-bottom: 0;clear: both;"><img src="http://extranet.stayhopper.com/public/mail/Stayhopper-Hotel.jpg" width="632" height="" alt="" style="outline: none;border: 0;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;line-height: 100%;max-width: 632px;margin-left: auto;margin-right: auto;width: 100% !important;height: auto !important;"></p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
            </td>
        </tr>
    </tbody>
</table>
<table class="email_table" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
    <tbody>
        <tr>
            <td class="email_body tc" style="box-sizing: border-box;vertical-align: top;line-height: 100%;text-align: center;padding-left: 16px;padding-right: 16px;background-color: #d8dde4;font-size: 0 !important;">
                <!--[if (mso)|(IE)]><table width="632" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:632px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                <div class="email_container" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 632px;margin: 0 auto;text-align: center;line-height: inherit;min-width: 0 !important;">
                    <table class="content_section" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                        <tbody>
                            <tr>
                                <td class="content_cell" style="box-sizing: border-box;vertical-align: top;width: 100%;background-color: #ffffff;font-size: 0;text-align: center;padding-left: 16px;padding-right: 16px;line-height: inherit;min-width: 0 !important;">
                                    <!-- col-6 -->
                                    <div class="email_row tl" style="box-sizing: border-box;font-size: 0;display: block;width: 100%;vertical-align: top;margin: 0 auto;text-align: left;clear: both;line-height: inherit;min-width: 0 !important;max-width: 600px !important;">
                                    <!--[if (mso)|(IE)]><table width="600" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:600px;Margin:0 auto 0 0;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                                        <div class="col_6" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 600px;line-height: inherit;min-width: 0 !important;">
                                            <table class="column" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                                                <tbody>
                                                    <tr>
                                                        <td class="column_cell px tl" style="box-sizing: border-box;vertical-align: top;width: 100%;min-width: 100%;padding-top: 16px;padding-bottom: 16px;font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 23px;color: #888888;mso-line-height-rule: exactly;text-align: left;padding-left: 16px;padding-right: 16px;">
                                                            <h4 style="color: #383d42;margin-left: 0;margin-right: 0;margin-top: 20px;margin-bottom: 8px;padding: 0;font-weight: bold;font-size: 19px;line-height: 25px;">Hello,</h4>
                                                            <p style="font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 23px;color: #888888;mso-line-height-rule: exactly;display: block;margin-top: 0;margin-bottom: 16px;">Congratulations for signing up on Stayhopper - The UAE's first microstay service provider. This email contains your credentials for accessing our Extranet portal. One of our training experts will contact you soon to help you bring up to speed and onboard your hotel in our system. We look forward to a long-term business partnership.</p>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
            </td>
        </tr>
    </tbody>
</table>

<table class="email_table" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
    <tbody>
        <tr>
            <td class="email_body tc" style="box-sizing: border-box;vertical-align: top;line-height: 100%;text-align: center;padding-left: 16px;padding-right: 16px;background-color: #d8dde4;font-size: 0 !important;">
                <!--[if (mso)|(IE)]><table width="632" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:632px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                <div class="email_container" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 632px;margin: 0 auto;text-align: center;line-height: inherit;min-width: 0 !important;">
                    <table class="content_section" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                        <tbody>
                            <tr>
                                <td class="content_cell" style="box-sizing: border-box;vertical-align: top;width: 100%;background-color: #ffffff;font-size: 0;text-align: center;padding-left: 16px;padding-right: 16px;line-height: inherit;min-width: 0 !important;">
                                    <!-- col_3 -->
                                    <div class="email_row" style="box-sizing: border-box;font-size: 0;display: block;width: 100%;vertical-align: top;margin: 0 auto;text-align: center;clear: both;line-height: inherit;min-width: 0 !important;max-width: 600px !important;">
                                        <!--[if (mso)|(IE)]><table width="300" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:300px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                                            <div class="col_3 col_center" style="box-sizing: border-box;font-size: 0;display: block;width: 100%;vertical-align: top;max-width: 300px;margin-left: auto;margin-right: auto;line-height: inherit;min-width: 0 !important;">
                                                <table class="column" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                                                    <tbody>
                                                        <tr>
                                                            <td class="column_cell px tc" style="box-sizing: border-box;vertical-align: top;width: 100%;min-width: 100%;padding-top: 16px;padding-bottom: 16px;font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 23px;color: #888888;mso-line-height-rule: exactly;text-align: center;padding-left: 16px;padding-right: 16px;">
                                                                <h4 style="color: #383d42;margin-left: 0;margin-right: 0;margin-top: 20px;margin-bottom: 8px;padding: 0;font-weight: bold;font-size: 19px;line-height: 25px;"><h6 class="tm" style="color: #a9b3ba;margin-left: 0;margin-right: 0;margin-top: 20px;margin-bottom: 8px;padding: 0;font-weight: bold;font-size: 13px;line-height: 20px;">Username</h6>
                                                                <table class="ncard" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;">
                                                                    <tbody>
                                                                        <tr>
                                                                            <td class="ncard_c light_b tc px py" style="box-sizing: border-box;vertical-align: top;color: #888888;overflow: hidden;border-radius: 4px;background-color: #f2f2f5;text-align: center;padding-top: 16px;padding-bottom: 16px;padding-left: 16px;padding-right: 16px;line-height: inherit;font-family: Helvetica, Arial, sans-serif;">
                                                                                <h5 class="mt_0 mb_0" style="color: #383d42;margin-left: 0;margin-right: 0;margin-top: 0;margin-bottom: 0;padding: 0;font-weight: bold;font-size: 16px;line-height: 21px;"><a href="#" class="td" style="text-decoration: none;color: #888888;line-height: inherit;"><span class="td" style="text-decoration: none;color: #888888;line-height: inherit;">{{USERNAME}}</span></a></h5>
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
            </td>
        </tr>
    </tbody>
</table>

<table class="email_table" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
    <tbody>
        <tr>
            <td class="email_body tc" style="box-sizing: border-box;vertical-align: top;line-height: 100%;text-align: center;padding-left: 16px;padding-right: 16px;background-color: #d8dde4;font-size: 0 !important;">
                <!--[if (mso)|(IE)]><table width="632" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:632px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                <div class="email_container" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 632px;margin: 0 auto;text-align: center;line-height: inherit;min-width: 0 !important;">
                    <table class="content_section" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                        <tbody>
                            <tr>
                                <td class="content_cell" style="box-sizing: border-box;vertical-align: top;width: 100%;background-color: #ffffff;font-size: 0;text-align: center;padding-left: 16px;padding-right: 16px;line-height: inherit;min-width: 0 !important;">
                                    <!-- col_2 -->
                                    <div class="email_row" style="box-sizing: border-box;font-size: 0;display: block;width: 100%;vertical-align: top;margin: 0 auto;text-align: center;clear: both;line-height: inherit;min-width: 0 !important;max-width: 600px !important;">
                                        <!--[if (mso)|(IE)]><table width="200" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:200px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                                            <div class="col_2 col_center" style="box-sizing: border-box;font-size: 0;display: block;width: 100%;vertical-align: top;max-width: 200px;margin-left: auto;margin-right: auto;line-height: inherit;min-width: 0 !important;">
                                                <table class="column" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                                                    <tbody>
                                                        <tr>
                                                            <td class="column_cell px tc" style="box-sizing: border-box;vertical-align: top;width: 100%;min-width: 100%;padding-top: 16px;padding-bottom: 16px;font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 23px;color: #888888;mso-line-height-rule: exactly;text-align: center;padding-left: 16px;padding-right: 16px;">
                                                                <h5 class="tm" style="color: #a9b3ba;margin-left: 0;margin-right: 0;margin-top: 0;margin-bottom: 8px;padding: 0;font-weight: bold;font-size: 16px;line-height: 21px;">Password</h5>
                                                                <table class="ncard" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;">
                                                                    <tbody>
                                                                        <tr>
                                                                            <td class="ncard_c light_b tc px py" style="box-sizing: border-box;vertical-align: top;color: #888888;overflow: hidden;border-radius: 4px;background-color: #f2f2f5;text-align: center;padding-top: 16px;padding-bottom: 16px;padding-left: 16px;padding-right: 16px;line-height: inherit;font-family: Helvetica, Arial, sans-serif;">
                                                                                <h3 class="mt_0 mb_0" style="color: #383d42;margin-left: 0;margin-right: 0;margin-top: 0;margin-bottom: 0;padding: 0;font-weight: bold;font-size: 23px;line-height: 30px;">{{PASSWORD}}</h3>
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
            </td>
        </tr>
    </tbody>
</table>
                  
                    <!-- spacer-lg -->
                    <table class="email_table" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                        <tbody>
                            <tr>
                                <td class="email_body tc" style="box-sizing: border-box;vertical-align: top;line-height: 100%;text-align: center;padding-left: 16px;padding-right: 16px;background-color: #d8dde4;font-size: 0 !important;">
                                    <!--[if (mso)|(IE)]><table width="632" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:632px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                                    <div class="email_container" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 632px;margin: 0 auto;text-align: center;line-height: inherit;min-width: 0 !important;">
                                        <table class="content_section" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                                            <tbody>
                                                <tr>
                                                    <td class="content_cell" style="box-sizing: border-box;vertical-align: top;width: 100%;background-color: #ffffff;font-size: 0;text-align: center;padding-left: 16px;padding-right: 16px;line-height: inherit;min-width: 0 !important;">
                                                        <table class="hr_rl" align="center" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;font-size: 0;line-height: 1px;mso-line-height-rule: exactly;min-height: 1px;overflow: hidden;height: 2px;background-color: transparent !important;">
                                                            <tbody>
                                                                <tr>
                                                                    <td class="hr_ep pte" style="box-sizing: border-box;vertical-align: top;font-size: 0;line-height: inherit;mso-line-height-rule: exactly;min-height: 1px;overflow: hidden;height: 2px;padding-top: 32px;background-color: transparent !important;">&nbsp; </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <table class="email_table" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
    <tbody>
        <tr>
            <td class="email_body tc" style="box-sizing: border-box;vertical-align: top;line-height: 100%;text-align: center;padding-left: 16px;padding-right: 16px;background-color: #d8dde4;font-size: 0 !important;">
                <!--[if (mso)|(IE)]><table width="632" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:632px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                <div class="email_container" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 632px;margin: 0 auto;text-align: center;line-height: inherit;min-width: 0 !important;">
                    <table class="content_section" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                        <tbody>
                            <tr>
                                <td class="content_cell tc" style="box-sizing: border-box;vertical-align: top;width: 100%;background-color: #ffffff;font-size: 0;text-align: center;padding-left: 16px;padding-right: 16px;line-height: inherit;min-width: 0 !important;">
                                    <table class="column" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                                        <tbody>
                                            <tr>
                                                <td class="column_cell px pt_0 pb_xs tc" style="box-sizing: border-box;vertical-align: top;width: 100%;min-width: 100%;padding-top: 0;padding-bottom: 8px;font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 23px;color: #888888;mso-line-height-rule: exactly;text-align: center;padding-left: 16px;padding-right: 16px;">
                                                    <table class="ebtn" align="center" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;display: table;margin-left: auto;margin-right: auto;">
                                                        <tbody>
                                                            <tr>
                                                                <td class="default_b" style="box-sizing: border-box;vertical-align: top;background-color: #102579;line-height: 20px;font-family: Helvetica, Arial, sans-serif;mso-line-height-rule: exactly;border-radius: 4px;text-align: center;font-weight: bold;font-size: 14px;padding: 13px 22px;"><a href="{{URL}}" style="text-decoration: none;line-height: inherit;color: #ffffff;"><span style="text-decoration: none;line-height: inherit;text-transform:uppercase;color: #ffffff;">Click here to login</span></a></td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
            </td>
        </tr>
    </tbody>
</table>
                        <table class="email_table" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                        <tbody>
                            <tr>
                                <td class="email_body tc" style="box-sizing: border-box;vertical-align: top;line-height: 100%;text-align: center;padding-left: 16px;padding-right: 16px;background-color: #d8dde4;font-size: 0 !important;">
                                    <!--[if (mso)|(IE)]><table width="632" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:632px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                                    <div class="email_container" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 632px;margin: 0 auto;text-align: center;line-height: inherit;min-width: 0 !important;">
                                        <table class="content_section" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                                            <tbody>
                                                <tr>
                                                    <td class="content_cell" style="box-sizing: border-box;vertical-align: top;width: 100%;background-color: #ffffff;font-size: 0;text-align: center;padding-left: 16px;padding-right: 16px;line-height: inherit;min-width: 0 !important;">
                                                        <table class="hr_rl" align="center" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;font-size: 0;line-height: 1px;mso-line-height-rule: exactly;min-height: 1px;overflow: hidden;height: 2px;background-color: transparent !important;">
                                                            <tbody>
                                                                <tr>
                                                                    <td class="hr_ep pte" style="box-sizing: border-box;vertical-align: top;font-size: 0;line-height: inherit;mso-line-height-rule: exactly;min-height: 1px;overflow: hidden;height: 2px;padding-top: 32px;background-color: transparent !important;">&nbsp; </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <!-- footer_blank_center -->
                   <table class="email_table" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
    <tbody>
        <tr>
            <td class="email_body email_end tc" style="box-sizing: border-box;vertical-align: top;line-height: 100%;text-align: center;padding-left: 16px;padding-right: 16px;padding-bottom: 32px;background-color: #d8dde4;font-size: 0 !important;">
                <!--[if (mso)|(IE)]><table width="632" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:632px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                <div class="email_container" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 632px;margin: 0 auto;text-align: center;line-height: inherit;min-width: 0 !important;">
                    <table class="content_section" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                        <tbody>
                            <tr>
                                <td class="content_cell footer_c bt brb pt pb" style="box-sizing: border-box;vertical-align: top;width: 100%;background-color: #ffffff;font-size: 0;text-align: center;padding-left: 16px;padding-right: 16px;border-radius: 0 0 4px 4px;padding-top: 16px;padding-bottom: 16px;border-top: 1px solid #d8dde4;line-height: inherit;min-width: 0 !important;">
                                    <!-- col-6 -->
                                    <div class="email_row" style="box-sizing: border-box;font-size: 0;display: block;width: 100%;vertical-align: top;margin: 0 auto;text-align: center;clear: both;line-height: inherit;min-width: 0 !important;max-width: 600px !important;">
                                    <!--[if (mso)|(IE)]><table width="600" border="0" cellspacing="0" cellpadding="0" align="center" style="vertical-align:top;width:600px;Margin:0 auto;"><tbody><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
                                        <div class="col_6" style="box-sizing: border-box;font-size: 0;display: inline-block;width: 100%;vertical-align: top;max-width: 600px;line-height: inherit;min-width: 0 !important;">
                                            <table class="column" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                                                <tbody>
                                                    <tr>
                                                        <td class="column_cell px pt_xs pb_0 tc" style="box-sizing: border-box;vertical-align: top;width: 100%;min-width: 100%;padding-top: 8px;padding-bottom: 0;font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 23px;color: #a9b3ba;mso-line-height-rule: exactly;text-align: center;padding-left: 16px;padding-right: 16px;">
                                                            <p class="imgr imgr44 mb_xs" style="font-family: Helvetica, Arial, sans-serif;font-size: 0;line-height: 100%;color: #a9b3ba;mso-line-height-rule: exactly;display: block;margin-top: 0;margin-bottom: 8px;clear: both;"><a href="http://www.stayhopper.com" style="text-decoration: underline;line-height: 1;color: #a9b3ba;"><img src="http://extranet.stayhopper.com/public/mail/logo_xs_dark.png" width="44" height="44" alt="" style="outline: none;border: 0;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;line-height: 100%;max-width: 44px;margin-left: auto;margin-right: auto;width: 100% !important;height: auto !important;"></a></p>
                                                            <p class="mb_xxs" style="font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 23px;color: #a9b3ba;mso-line-height-rule: exactly;display: block;margin-top: 0;margin-bottom: 4px;">Suite 1702, Level 17, Boulevard Plaza Tower 1,<br> Downtown Dubai, Dubai, UAE.
                                                            </p>
                                                            <p class="small mb_xxs" style="font-family: Helvetica, Arial, sans-serif;font-size: 14px;line-height: 20px;color: #a9b3ba;mso-line-height-rule: exactly;display: block;margin-top: 0;margin-bottom: 4px;">© 2018 Stayhopper FZ LLC</p>
                                                            <table class="column" width="100%" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;width: 100%;min-width: 100%;">
                                                <tbody>
                                                    <tr>
                                                        <td class="column_cell px pt_xs pb_0 ord_cell tr" style="box-sizing: border-box;vertical-align: top;width: 100%;min-width: 100%;padding-top: 8px;padding-bottom: 0;font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 23px;color: #a9b3ba;mso-line-height-rule: exactly;text-align: center;padding-left: 16px;padding-right: 16px;">
                                                            <p class="fsocial mb_0" style="font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 100%;color: #a9b3ba;mso-line-height-rule: exactly;display: block;margin-top: 0;margin-bottom: 0;"><a href="https://www.facebook.com/stayhopper" style="text-decoration: underline;line-height: inherit;color: #a9b3ba;"><img src="http://extranet.stayhopper.com/public/mail/social-facebook.png" width="24" height="24" alt="" style="outline: none;border: 0;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;line-height: 100%;max-width: 24px;height: auto !important;"></a> &nbsp;&nbsp; <a href="https://twitter.com/stayhopper" style="text-decoration: underline;line-height: inherit;color: #a9b3ba;"><img src="http://extranet.stayhopper.com/public/mail/social-twitter.png" width="24" height="24" alt="" style="outline: none;border: 0;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;line-height: 100%;max-width: 24px;height: auto !important;"></a> &nbsp;&nbsp; <a href="https://www.instagram.com/stayhopper/" style="text-decoration: underline;line-height: inherit;color: #a9b3ba;"><img src="http://extranet.stayhopper.com/public/mail/social-instagram.png" width="24" height="24" alt="" style="outline: none;border: 0;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;line-height: 100%;max-width: 24px;height: auto !important;"></a></p>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!--[if (mso)|(IE)]></td></tr></tbody></table><![endif]-->
            </td>
        </tr>
    </tbody>
</table>
</body>
</html>
  `;
  html_body = html_body.replace('{{USERNAME}}',hoteladmin.email);
  html_body =  html_body.replace('{{PASSWORD}}',password);
  html_body =  html_body.replace('{{URL}}',app_url);     
  msg = {
    to: hoteladmin.email,
    bcc: [{ email: config.website_admin_bcc_email }],
    from: {
        email: config.website_admin_from_email,
        name: config.fromname
    },
    subject: "STAYHOPPER: Account has been created!",
    text:
      "Congratulations! Your account has been created",
    html: html_body
  };
  sgMail.send(msg);
  return res.json({
    status:1,
    message:'Mail send successfully!'
  })
});
module.exports = router;
