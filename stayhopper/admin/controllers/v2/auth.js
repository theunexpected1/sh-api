const express = require("express");
const router = express.Router();
const joi = require("joi");
const generator = require("generate-password");
const passport = require("passport");
const jwt = require('jsonwebtoken');
const fs = require('fs');
const bcrypt = require('bcrypt');
const Administrator = require("../../../db/models/administrators");

const config = require('config');
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);

var http = require('http');
var url = require('url') ;
const User = require("../../../db/models/admins");
const jwtMiddleware = require("../../../middleware/jwt");
console.log('config.app_url', config.app_url);

router.get("/ping", async (req, res) => {
  res
    .status(200)
    .send({
      status: 1,
      message: "Ping success",
    }).end()
  ;
});

router.post("/login", passport.authenticate('local-administrator-login'), async (req, res) => {
  const token = jwt.sign(req.user.toJSON(), process.env.API_SECRET || 'secret');
  if (req.user) {
    res
      .status(200)
      .json({
        status: 1,
        message: "Login successful",
        token: token,
        user: req.user
      })
    ;
  } else {
    res
      .status(200)
      .json({
        status: 0,
        message: "Invalid Login credentials!"
      })
    ;
  }
});

router.post("/auto-login", async (req, res) => {
  const administrator = await Administrator
    .findOne({
      email: req.body.email,
      autoLoginCode: req.body.autoLoginCode
    })
    .populate('role')
    .select('+email')
    .select('+password')
  ;

  if (administrator) {
    const token = jwt.sign(administrator.toJSON(), process.env.API_SECRET || 'secret');
    administrator.autoLoginCode = '';
    await administrator.save();
    res
      .status(200)
      .json({
        status: 1,
        message: "Login successful",
        token: token,
        user: administrator
      })
    ;
  } else {
    res
      .status(200)
      .json({
        status: 0,
        message: "Invalid Login token!"
      })
    ;
  }
});

router.post("/authorized", jwtMiddleware.administratorAuthenticationRequired, (req, res) => {
  console.log('Success');
  res.status(200).json({});
})


router.post("/migrate-roles", jwtMiddleware.administratorAuthenticationRequired, async (req, res) => {

  const Roles = require("../../../db/models/roles");
  let rolesCount = await Roles.countDocuments({});

  try {
    if (!rolesCount) {
      const newRoles = [{
        "_id" : "5efc8e8f5694cbf9675b2866",
        "name" : "Super Admin",
        "permissions" : [
          "SHOW_DASHBOARD",
          "SHOW_FULL_DASHBOARD",
          "SHOW_SETTINGS",
          "LIST_PROPERTIES",
          "LIST_ALL_PROPERTIES",
          "LIST_ROOMS",
          "LIST_BOOKINGS",
          "LIST_ALL_BOOKINGS",
          "LIST_USERS",
          "LIST_USER_RATINGS",
          "LIST_ADMINISTRATORS",
          "LIST_INVOICES",
          "LIST_ALL_INVOICES"
        ]
      }, {
        "_id" : "5efc8ef65694cbf9675b28a3",
        "name" : "Hotel Admin",
        "permissions" : [
          "SHOW_DASHBOARD",
          "SHOW_OWN_DASHBOARD",
          "LIST_PROPERTIES",
          "LIST_OWN_PROPERTIES",
          "LIST_ROOMS",
          "LIST_BOOKINGS",
          "LIST_OWN_BOOKINGS",
          "LIST_INVOICES",
          "LIST_OWN_INVOICES"
        ]
      }, {
        "_id" : "5f1a9e9a016a9ccac0177d39",
        "name" : "Receptionist",
        "permissions" : [
          "SHOW_DASHBOARD",
          "SHOW_OWN_DASHBOARD",
          "LIST_PROPERTIES",
          "LIST_OWN_PROPERTIES",
          "LIST_ROOMS"
        ]
      }];

      console.log(`Migration: Roles: Adding ${newRoles.length} roles...`);
      await Roles.insertMany(newRoles);
      console.log(`Migration: Roles: Added ${newRoles.length} roles...`);
    } else {
      console.log(`Migration: Roles: Skipping as ${rolesCount} roles exist`);
    }
  } catch (e) {
    console.log('error in migrating roles', e);
  }

  res.status(200).json({});
})

router.post("/migrate-admins", jwtMiddleware.administratorAuthenticationRequired, async (req, res) => {

  const HotelAdmin = require("../../../db/models/hoteladmins");
  let hotelAdmins = await HotelAdmin.find().exec();

  try {
    hotelAdmins.map(async hotelAdmin => {
      const newAdminData = hotelAdmin.toJSON();
      delete newAdminData._id;
      delete newAdminData.__v;
      newAdminData.name = hotelAdmin.contact_person;
      newAdminData.role = "5efc8ef65694cbf9675b28a3";
      const administratorWithSameEmail = await Administrator.findOne({email: hotelAdmin.email}).exec();
      if (administratorWithSameEmail) {
        console.log('Skipping as user already exists', hotelAdmin.email);
      } else {
        const newAdmin = new Administrator(newAdminData);
        console.log(`Admin "${newAdmin.name} (${newAdmin.email})" migrated`);
        newAdmin.save();
      }
    });
  } catch (e) {
    console.log('error in ', newAdmin.name, e);
  }

  res.status(200).json({});
})

router.post("/migrate-properties-agreement", jwtMiddleware.administratorAuthenticationRequired, async (req, res) => {
  // 5. set existing properties with no "source" to have agreement.isSignedAgreement set to true
  const Property = require("../../../db/models/properties");
  // Ensure we run only once
  let properties = await Property.find({agreement: {$exists: false}, source: {$exists: false}}).exec();

  try {
    properties
      // Test with Zain International
      // .filter(p => p._id.toString() === '5c0ce7258607b05625233208')
      .map(async property => {
        console.log('Attempting... Property', property.name, property.agreement);

        property.agreement = {};
        property.agreement.isAgreementSigned = true;
        await property.save();
        console.log('Migrated Property', property.name);
      })
    ;
  } catch (e) {
    console.log('error in ', newAdmin.name, e);
  }

  res.status(200).json({});
});

router.post("/migrate-properties", jwtMiddleware.administratorAuthenticationRequired, async (req, res) => {

  const Property = require("../../../db/models/properties");
  const Currency = require("../../../db/models/currencies");
  const HotelAdmin = require("../../../db/models/hoteladmins");

  // Ensure we run only once
  let properties = await Property.find({administrator: {$exists: false}}).exec();
  let currencyAED = await Currency.findOne({name: new RegExp('dirham', 'i')});

  // Pending:
  // 1. copy contactinfo.email to primaryReservationEmail
  // 2. set AED as default currency
  // 3. - get 'property.company' (hotel_admins)'s email address
  //    - find administrator with same email address
  //    - set administrator as 'property.administrator' (administrators)
  //    - Set administrator in allAdministrators as well
  // 4. set property charges into the new format

    try {
      properties
        // Test with Zain International
        // .filter(p => p._id.toString() === '5c0ce7258607b05625233208')
        .map(async property => {
          console.log('Attempting... Property', property.name);
          const propertyHotelAdmin = await HotelAdmin.findOne({_id: property.company}).exec();
          const migratedAdministratorWithSameEmail = propertyHotelAdmin
            ? await Administrator.findOne({email: propertyHotelAdmin.email}).exec()
            : ''
          ;

          // , {name: 1, company: 1, administrator: 1, email: 1, primaryReservationEmail:1, currency: 1}
          // 1.
          property.primaryReservationEmail = property.contactinfo.email;
          // 2.
          property.currency = currencyAED ? currencyAED._id : '';
          // 3.
          property.administrator = migratedAdministratorWithSameEmail ? migratedAdministratorWithSameEmail._id : '';
          property.allAdministrators = [property.administrator];
          // 4.
          const charges = [];
          if (property.payment) {
            if (property.payment.excluding_vat) {
              charges.push({
                name: 'VAT',
                id: 'vat',
                chargeType: 'percentage',
                value: parseInt(property.payment.excluding_vat.replace('%', '').replace('AED', '').trim())
              })
            }
            if (property.payment.tourism_fee) {
              charges.push({
                name: 'Tourism Fee',
                id: 'tourism_fee',
                chargeType: 'value',
                value: parseInt(property.payment.tourism_fee.replace('%', '').replace('AED', '').trim())
              })
            }if (property.payment.muncipality_fee) {
              charges.push({
                name: 'Municipality Fee',
                id: 'muncipality_fee',
                chargeType: 'percentage',
                value: parseInt(property.payment.muncipality_fee.replace('%', '').replace('AED', '').trim())
              })
            }if (property.payment.service_charge) {
              charges.push({
                name: 'Property Service Charge',
                id: 'service_charge',
                chargeType: 'percentage',
                value: parseInt(property.payment.service_charge.replace('%', '').replace('AED', '').trim())
              })
            }
          }
          property.charges = charges;
          await property.save();
          console.log('Migrated Property', property.name);
        })
      ;
    } catch (e) {
      console.log('error in ', newAdmin.name, e);
    }

  res.status(200).json({});
});

router.post("/migrate-properties-anytimecheckin", jwtMiddleware.administratorAuthenticationRequired, async (req, res) => {

  const Property = require("../../../db/models/properties");

  // Ensure we run only once
  let properties = await Property.find({anyTimeCheckin: {$exists: false}}).exec();

  // Pending:
  // 1. set anyTimeCheckin to true

  try {
    properties
      // Test with Zain International
      // .filter(p => p._id.toString() === '5c0ce7258607b05625233208')
      .map(async property => {
        console.log('Attempting to change anyTimeCheckin... Property', property.name);
        // 1.
        property.anyTimeCheckin = true;
        await property.save();
        console.log('Migrated Property to set anyTimeCheckin to "true"', property.name);
      })
    ;
  } catch (e) {
    console.log('error in ', newAdmin.name, e);
  }

  res.status(200).json({});
})


router.post("/migrate-properties-location", jwtMiddleware.administratorAuthenticationRequired, async (req, res) => {

  const Property = require("../../../db/models/properties");

  // Ensure we run only once
  let properties = await Property.find({
    location: {$exists: true},
    contactinfo: {$exists: true},
    'location.address': '',
    'contactinfo.location': {$ne: ''}
  }).exec();

  // Pending:
  // 1. set anyTimeCheckin to true

  try {
    properties
      // Test with Zain International
      // .filter(p => p._id.toString() === '5c0ce7258607b05625233208')
      .map(async property => {
        console.log('Attempting to set property.location.address ... Property', property.name);
        // 1.
        property.location = property.location || {};
        property.location.address = property.contactinfo && property.contactinfo.location ? property.contactinfo.location : '';
        await property.save();
        console.log(`Migrated Property to set location to "${property.location.address}" for ${property.name}`);
      })
    ;
  } catch (e) {
    console.log('error in ', newAdmin.name, e);
  }

  res.status(200).json({});
})

router.post("/migrate-rooms", jwtMiddleware.administratorAuthenticationRequired, async (req, res) => {

  const Room = require("../../../db/models/rooms");
  const GuestNumber = require("../../../db/models/guestnumbers");

  // Ensure we run only once
  let rooms = await Room.find({number_of_guests: {$exists: false}}).exec();
  let migratedRooms = 0;

  // 1. Number of guests (migrate from number to object) 

  try {
    const migrateRooms = await Promise.all(
      rooms
        .map(async room => {

          if (room.number_guests) {
            const guestNumber = await GuestNumber.findOne({
              value: { $in: [room.number_guests.toString(), parseInt(room.number_guests)]},
              $or: [
                {
                  childrenValue: {$exists: false}
                },
                {
                  childrenValue: 0
                }
              ]
            });

            if (guestNumber) {
              room.number_of_guests = guestNumber;
              migratedRooms++;
            }

            // Pending: 1.
            await room.save();
          }
        })
    );
    console.log(`Migrated ${migratedRooms}/${rooms.length} rooms`);
  } catch (e) {
    console.log('error in ', newAdmin.name, e);
  }

  res.status(200).json({});
});

router.post("/logout", (req, res) => {
  console.log('Success');
  res.status(200).json({});
})

router.post("/reset-password", async (req, res) => {
  let hostname = req.headers.host; // hostname = 'localhost:8080'
  let pathname = url.parse(req.url).pathname; // pathname = '/MyApp'
  let app_url = 'http://' + hostname;
  let user = await Administrator.findOne({ email: req.body.email }).select('+email');
  if (user) {
    var password = generator.generate({
      length: 10,
      numbers: true
    });
    user.password = await bcrypt.hashSync(password, 10);
    await user.save();
    let html_body = fs.readFileSync('public/reset_password.html', 'utf8');
    html_body = html_body.replace('{{EMAIL}}', user.email);
    html_body = html_body.replace('{{PASSWORD}}', password);
    html_body = html_body.replace('{{URL}}', config.app_url);

    let msg = {
      to: user.email,
      bcc: [{email:config.website_admin_bcc_email},{email:"resetpwds@stayhopper.com"}],
      from: {
        email: config.website_admin_from_email,
        name: config.fromname
      },
      // bcc: [{email:"rahul.vagadiya@gmail.com"}],
      // from: {
      //   email: "rahul.vagadiya@gmail.com",
      //   name: "Rahul Vagadiya"
      // },
      subject: "STAYHOPPER: Reset Password",
      text: "Password reset for your account, see details below:",
      html: html_body
    };
    sgMail.send(msg);
    return res.json({
      status: 1,
      message: "New password is sent to your Email ID"
    });
  } else {
    return res.json({
      status: 0,
      message: "Email id is not registered with us!"
    });
  }
});


router.post('/change-password', jwtMiddleware.administratorAuthenticationRequired, async (req, res) => {
  let errors = [];
  try {
    const passwordSchema = {
      old_password: joi.string().required(),
      new_password: joi.string().required(),
      confirm_password: joi.string().required()
    }
    const admin = await Administrator.findOne({ _id: req.user._id }).select('+password')
    const valid = joi.validate(req.body, passwordSchema, { abortEarly: false });
    if (req.body.new_password != req.body.confirm_password) {
      return res.status(200).json({ 'status': 0, 'message': 'Password and Confirm password must be same' });
    }

    const valid1 = await bcrypt.compare(req.body.old_password, admin.password);

    if (valid1) {
      if (valid.error) {
        errors = valid.error.details.map((error) => {
          return error.message;
        });
      }
      if (errors.length > 0) {
        return res.status(200).json({ 'status': 0, 'errors': errors });
      }

      admin.password = await bcrypt.hashSync(req.body.new_password, 10);

      const result = await admin.save();
      if (result) {
        return res.json({ 'status': 1, 'message': 'Password updated successfully', 'data': result });
      }
    } else {
      return res.json({ 'status': 0, 'message': 'Current Password not matching.' })
    }
  } catch (error) {
    console.log(error)
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }
})

module.exports = router;
