const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const _ = require("underscore");
const moment = require("moment");
const mongoose = require("mongoose");
const generator = require("generate-password");
const multer = require("multer");
const pify = require("pify");
const path = require("path");
let url = require('url') ;
const sharp = require('sharp');
const request = require('request');
const fs = require('fs');

const config = require("config");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
var Mailchimp = require("mailchimp-api-v3");
var mailchimp = new Mailchimp(config.mailchimp_api_key);

const User = require("../../db/models/users");
const UserBooking = require("../../db/models/userbookings");
const CompletedBooking = require("../../db/models/completedbookings");
const UserRating = require('../../db/models/userratings');

router.post("/", async (req, res) => {
  user = new User();
  user.name = req.body.name;
  user.email = req.body.email;
  user.mobile = req.body.mobile;
  user.country = req.body.country;
  let device_type = req.body.device_type;
  let list_id = "";
  if(device_type == "ios"){
    list_id = config.mailchimp_ios_id;
  }else{
    list_id = config.mailchimp_android_id;
  }
  let password = req.body.password;
  user.password = await bcrypt.hashSync(password, 10);

  //check email exists
  const emailExists = await User.findOne({email:user.email});
  if(emailExists){
    return res.json({ status: 'Failed', message:"Account exists with same email" });
  }

  try {
    await user.save();
    let html_body = fs.readFileSync('public/user_welcome.html', 'utf8');
    html_body = html_body.replace('{{ NAME }}',user.name);
    msg = {
      to: user.email,
      bcc: [{ email: config.website_admin_bcc_email}],
      from: {
        email: config.website_admin_from_email,
        name: config.fromname
      },
      subject: "STAYHOPPER: Welcome to Stayhopper!",
      text: "Congratulations! Your account has been created",
      html: html_body
    };
    sgMail.send(msg);

    await mailchimp.post("/lists/" + list_id, {
      members: [
        {
          email_address: user.email,
          status: "subscribed"
        }
      ]
    })
    .then(function(result) {
      console.log(result);
    })
    .catch(function(err) {
      console.log(err);
    });
    return res.json({ status: "Success", data: user });
  } catch (error) {
    console.log(error);
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 'Failed', errors: errors });
  }
});

router.post("/checklogin", async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  let user = await User.findOne({ 'email': username });
  if (user) {
    var valid = await bcrypt.compare(password, user.password);
    if (valid) {
      user = user.toObject();
      delete user.password;
      return res.json({ status: "Success", data: user });
    }
  }
  return res.json({ status: "Failed", message: "Invalid Login credentials!" });
});

router.post('/recoverpassword', async (req, res) => {
  let hostname = req.headers.host; // hostname = 'localhost:8080'
  let pathname = url.parse(req.url).pathname; // pathname = '/MyApp'
  let app_url = 'http://' + hostname;
  let email = req.body.email;
  let user = await User.findOne({ email: email });
  let password = null;
  if(user){
    password = generator.generate({
      length: 10,
      numbers: true
    });
    await bcrypt.hash(password, 10).then(result => {
      user.password = result;
    });
    await user.save();

    let html_body = fs.readFileSync('public/user_reset.html', 'utf8');
    html_body = html_body.replace('{{EMAIL}}',email);
    html_body = html_body.replace('{{PASSWORD}}',password);
    let msg = {
      to: email,
      bcc: [{email:config.website_admin_bcc_email},{email:"resetpwds@stayhopper.com"}],
      from: {
        email: config.website_admin_from_email,
        name: config.fromname
      },
      subject: "STAYHOPPER: Reset Password",
      text: "Stayhopper Account New Password:"+password,
      html: html_body
    };
    sgMail.send(msg);
    return res.json({status:'Success',message:"Password reset successfully. New Password is send to your registered email address"});
  }else{
    return res.json({status:'Failed',message:"Could not reset password, No user is registered with provided email address"});
  }
});

router.get("/bookings", async (req, res) => {
  user_id = req.query.id;
  //get user reivews
  let review = await UserRating.find({user:user_id}).select("");
  let reviews = []; 
  if(review.length > 0){
    for(var i=0;i<review.length;i++){
      if(typeof review[i].ub_id != 'undefined'){
        reviews.push(review[i].ub_id.toString());
      }
    }
  }
  // return res.json({reviews});
  type = req.query.type;
  current_date = moment().format("YYYY-MM-DD");
  let userbookings = [];
  if (type == "CURRENT") {
    try{
      userbookings = await UserBooking.find({
        $and: [
          { user: user_id },
          { date_checkin: { $gte: new Date(current_date) } },
          { paid: true }
        ]
      }).populate("property").populate("room.room");
    }catch (error) {
      return res.json({ status: "Failed", message: "No data" });
    }
  } else {
    try {
      userbookings = await CompletedBooking.find({
        $and: [
          { user: user_id },
          { paid: true }
        ]
      }).lean().exec();
      for(var i=0;i<userbookings.length;i++){
        userbookings[i].reviewed_status = 0;
        if(typeof userbookings[i].ub_id != 'undefined'){
          if(_.contains(reviews, userbookings[i].ub_id.toString())){
            userbookings[i].reviewed_status = 1;
          }
        }
      }
    } catch (error) {
      return res.json({ status: "Failed", message: "No data" });
    }
  }
  if (userbookings.length <= 0) {
    return res.json({ status: "Failed", message: "No data" });
  } else {
    return res.json({ status: "Success", data: userbookings });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/files/userpics");
  },
  filename: (req, file, cb) => {
    var ext = (path.extname(file.originalname) || '').toLowerCase();
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});

let upload = pify(
  multer({ storage: storage }).fields([
    { name: "image" }
  ])
);

router.post('/editprofile',async(req,res)=>{
  try {
    await upload(req, res);
  } catch (err) {
    return res.json({ status: 0, message: "Could not update" });
  }
  let user_id = req.body.user_id;
  let name = req.body.firstname;
  let last_name = req.body.lastname;
  let mobile = req.body.mobile;
  let email = req.body.email;

  //check email exists
  const emailExists = await User.findOne({email:email,_id:{$ne:user_id}});
  if(emailExists){
    return res.json({ status: 'Failed', message:"Account exists with same email" });
  }


  let city = req.body.city;
  let country = req.body.country;
  let image = null;
  if (req.files.image) {
    image = req.files.image[0].path || null;
  }

  let user = await User.findOne({_id:user_id});
  if(user){
    user.name = name;
    user.last_name = last_name;
    user.mobile = mobile;
    user.email = email;
    user.city = city;
    user.country = country;
    user.image = image;
    try{
      await user.save();
      return res.json({status:'Success',data:user});
    }catch(error){
      return res.json({status:'Failed',message:"Profile could not update"});
    }
  }else{
    return res.json({status:'Failed',message:"Profile could not update"});
  }
  
});

router.post('/changepassword',async(req,res)=>{
  let password = req.body.newpassword;
  let user_id = req.body.user_id;
  if(password && user_id){
    password = await bcrypt.hash(password, 10);
    user = await User.findOne({_id:user_id});
    if(user){
      user.password = password;
      try{
        await user.save();
        return res.json({status:"Success",message:"Password changed successfully"});
      }catch(err){
        return res.json({status:"Failed",message:"Password could not change"});
      }
    }else{
      return res.json({status:"Failed",message:"Password could not change"});
    }
  }else{
    return res.json({status:"Failed",message:"Password could not change"});
  }
});

router.post('/fblogin',async(req,res)=>{
  let name = req.body.name;
  let email = req.body.email;
  let image_link = req.body.image; //decodeURIComponent((req.body.image));
  let device_type = req.body.device_type;
  image_link = image_link.replace('%26','&');
  image_link = image_link.replace('%26','&');
  image_link = image_link.replace('%26','&');
  image_link = image_link.replace('%26','&');
  let list_id = "";
  if(device_type == "ios"){
    list_id = config.mailchimp_ios_id;
  }else{
    list_id = config.mailchimp_android_id;
  }
  let user = await User.findOne({email});
  if(user){
    if(image_link){
      request(image_link).pipe(fs.createWriteStream('./public/files/userpics/'+user._id+'.jpg'));
      user.image = 'public/files/userpics/'+user._id+'.jpg';
      await user.save();
    }
    delete user.password;    
  }else{
    user = new User();
    user.name = name;
    user.email = email;
    let password = generator.generate({
      length: 10,
      numbers: true
    });
    user.password = await bcrypt.hash(password, 10);
    if(image_link){
      request(image_link).pipe(fs.createWriteStream('./public/files/userpics/'+user._id+'.jpg'));
      user.image = 'public/files/userpics/'+user._id+'.jpg';
    }
    await user.save();
    await mailchimp
    .post("/lists/" + list_id, {
      members: [
        {
          email_address: user.email,
          status: "subscribed"
        }
      ]
    })
    .then(function(result) {
      console.log(result);
    })
    .catch(function(err) {
      console.log(err);
    });
    delete user.password;
  }
  return res.json({status:'Success',data:user,image:image_link});
});

router.post('/notify_cred',async(req,res)=>{
  let user_id = req.body.user_id;
  let device_type = req.body.device_type;
  device_token = req.body.device_token;
  isTokenExists = await User.findOne({device_token:device_token});
  if(isTokenExists){
    await User.updateMany(
      {device_token:device_token},
      {$set: {device_token:null}}
    );
  }
  user = await User.findOne({_id:user_id});
  if(user){
    user.device_type = device_type;
    user.device_token = device_token;
    await user.save();
    return res.json({
      status:'Success',
      message:'Notification credentials set successfully!'
    });
  }else{
    return res.json({
      status:'Failed',
      message:'No such user exists'
    });
  }
});

module.exports = router;
