const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const generator = require("generate-password");
const fs = require('fs');

var http = require('http');
var url = require('url') ;
const User = require("../db/models/hoteladmins");

const config = require('config');
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);

const loginSchema = {
  username: joi.string().required(),
  password: joi.string().required()
};

router.get("/", (req, res) => {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  if(req.session._id){
    res.redirect('/dashboard');
  }
  res.render("login");
});

router.post("/check", async (req, res) => {
  const validation = joi.validate(req.body, loginSchema, { abortEarly: false });
  var errors = [];
  if (validation.error) {
    errors = validation.error.details.map(error => {
      return error.message;
    });
  }
  if (errors.length > 0) {
    return res.status(200).json({ status: 0, errors: errors });
  } else {
    var session = req.session;
    let user = await User.findOne({
      $or: [{ email: req.body.username }]
    });
    if (user) {
      if (user.status == 0) {
        res.status(200).json({ status: 0, message: "Inactive User" });
      }
      var valid = await bcrypt.compare(req.body.password, user.password);
      if (valid) {
        session._id = user._id;
        session.name = user.contact_person;
        session.email = user.email;
        res.status(200).json({
          status: 1,
          message: "Login succeess. Reditecting to dashboard"
        });
      } else {
        res
          .status(200)
          .json({ status: 0, message: "Invalid Login credentialsz!" });
      }
    } else {
      res
        .status(200)
        .json({ status: 0, message: "Invalid Login credentials!" });
    }
  }
});

router.post("/resetpassword", async (req, res) => {
  let hostname = req.headers.host; // hostname = 'localhost:8080'
  let pathname = url.parse(req.url).pathname; // pathname = '/MyApp'
  let app_url = 'http://' + hostname;
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    var password = await generator.generate({
      length: 10,
      numbers: true
    });
    user.password = await bcrypt.hashSync(password, 10);
    await user.save();
    let html_body = fs.readFileSync('public/reset_password.html', 'utf8');
    html_body = html_body.replace('{{EMAIL}}',user.email);
    html_body = html_body.replace('{{PASSWORD}}',password);
    html_body = html_body.replace('{{URL}}',config.app_url);

    let msg = {
      to: user.email,
      bcc: [{email:config.website_admin_bcc_email},{email:"resetpwds@stayhopper.com"}],
      from: config.website_admin_from_email,
      fromname:config.fromname,
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

module.exports = router;
