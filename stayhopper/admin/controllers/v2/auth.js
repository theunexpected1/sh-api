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

router.post("/authorized", jwtMiddleware.administratorAuthenticationRequired, (req, res) => {
  console.log('Success');
  res.status(200).json({});
})

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
    user.password = password;
    await user.save();
    let html_body = fs.readFileSync('public/reset_password.html', 'utf8');
    html_body = html_body.replace('{{EMAIL}}', user.email);
    html_body = html_body.replace('{{PASSWORD}}', password);
    html_body = html_body.replace('{{URL}}', config.app_url);

    let msg = {
      to: user.email,
      bcc: [{email:config.website_admin_bcc_email},{email:"resetpwds@stayhopper.com"}],
      from: config.website_admin_from_email,
      fromname:config.fromname,
      // bcc: [{email:"rahul.vagadiya@gmail.com"}],
      // from: "rahul.vagadiya@gmail.com",
      // fromname: "Rahul Vagadiya",
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


router.post('/change-password', async (req, res) => {
  const admin = await Administrator.findOne({ _id: req.body.id }).select('+password')
  const passwordSchema = {
    old_password: joi.string().required(),
    new_password: joi.string().required(),
    confirm_password: joi.string().required(),
    id: joi.string().required(),
  }
  const valid = joi.validate(req.body, passwordSchema, { abortEarly: false });
  if (req.body.new_password != req.body.confirm_password) {
    return res.status(200).json({ 'status': 0, 'message': 'Password and Confirm password must be same' });
  }

  const valid1 = await bcrypt.compare(req.body.old_password, admin.password);
  if (valid1) {
      let errors = [];
      if (valid.error) {
        errors = valid.error.details.map((error) => {
          return error.message;
        });
      }
      if (errors.length > 0) {
        return res.status(200).json({ 'status': 0, 'errors': errors });
      }

      admin.password = req.body.new_password;

      try {
        const result = await admin.save();
        if (result) {
          return res.json({ 'status': 1, 'message': 'Password updated successfully', 'data': result });
        }
      } catch (error) {
        console.log(error)
        for (field in error.errors) {
          errors.push(error.errors[field].message);
        }
        return res.json({ status: 0, errors: errors });
      }
  } else {
    return res.json({ 'status': 0, 'message': 'Current Password not matching.' })
  }
})

module.exports = router;
