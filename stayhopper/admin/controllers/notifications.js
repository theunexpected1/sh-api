const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const config = require("config");
const User = require("../../db/models/users");
const FCM = require("fcm-node");
const paginate = require("express-paginate");

const Notifications = require("../../db/models/notifications");
const NotificationChild = require("../../db/models/notification_childs");

const send_fcm = async (title, body, priority,notification_id) => {
  let tokens = [];
  if(notification_id){
    let notifications = await NotificationChild.find({notification_id:notification_id}).populate('user_id');
    if(notifications.length > 0){
      for(var i=0;i<notifications.length;i++){
        tokens.push({
          id: notifications[i].user_id.device_token,
          type: notifications[i].user_id.device_type,
          notification_id:notifications[i]._id
        })  
      }
    }
  }
  let regTokens = tokens;
  for (i = 0; i < regTokens.length; i++) {
    if (regTokens[i].device_type == "ios") {
      var fcm = new FCM(config.fcm_server_key);
      var message = {
        to: regTokens[i].id,
        priority: "high",
        notification: {
          title,
          body,
          priority,
          badge: 1,
          notification_id:regTokens[i].notification_id
        }
      };
    } else {
      var fcm = new FCM(config.fcm_server_key_android);
      var message = {
        to: regTokens[i].id,
        priority: "high",
        notification:{
          title,
          body,
          priority,
          badge: 1,
          click_action: ".DashBoardActivity"
        },
        data:{
          type:"NOTIFICATION",
          notification_id:regTokens[i].notification_id
        }
      };
    }
    
    fcm.send(message, function(err, response) {
      if (err) {
        console.log("Something has gone wrong!", err);
      } else {
        console.log("Successfully sent with response: ", response);
      }
    });
  }
};

router.get("/", paginate.middleware(10, 50),async (req, res) => {
  let where = {notification_type:"GENERAL"};
  let notifications = await Notifications.find(where).sort({_id:-1}).limit(req.query.limit).skip(req.skip);
  let itemCount = await Notifications.find(where).count();
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    notifications: notifications,
    type:"general",
    itemCount: itemCount,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(20, pageCount, req.query.page),
  };
  res.render("admin/notifications/list", data);
});

router.get("/booking", paginate.middleware(10, 10), async (req, res) => {
  let active_page = 1;
  if(req.query.page){
    active_page = req.query.page;
  }
  let where = {notification_type:{$ne:'GENERAL'}};
  let notifications = await Notifications.find(where).sort({_id:-1}).limit(req.query.limit).skip(req.skip);
  let itemCount = await Notifications.find(where).count();
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    notifications: notifications,
    type:"booking",
    itemCount: itemCount,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
  };
  res.render("admin/notifications/list", data);
});

//insert
router.post("/", async (req, res) => {
  let title = req.body.title;
  let description = req.body.description;
  if (!title) {
    return res.json({ status: 0, message: "Title is required" });
  }
  if (!description) {
    return res.json({ status: 0, message: "Description is required" });
  }
  let notification = new Notifications();
  notification.title = title;
  notification.description = description;
  try {
    await notification.save();
    let user_list = [];
    let users = await User.find({device_token:{ $exists: true, $ne: null }});
    if(users.length > 0){
        for(var i=0;i<users.length;i++){
            let user = {};
            user.notification_id = notification._id;
            user.user_id = users[i]._id;
            user_list.push(user);
        }
        await NotificationChild.insertMany(user_list);
    }
    send_fcm(title, description, "High",notification._id);
    return res.json({
      status: 1,
      message: "Notifications Added successfully!",
      id: notification._id
    });
  } catch (error) {
    console.log(error);
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }
});

//edit
router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let notification = await Notifications.findOne({ _id: id });
  if (notification) {
    return res.json({ status: 1, data: notification });
  } else {
    return res.json({ status: 0, message: "No data" });
  }
});

//update
router.post("/update", async (req, res) => {
  let notification = await Notifications.findOne({ _id: req.body.id });
  notification.title = req.body.title;
  notification.description = req.body.description;
  try {
    await notification.save();
    send_fcm(notification.title, notification.description, "High",notification._id);
    return res.json({
      status: 1,
      message: "Notifications Updated successfully!",
      id: notification._id
    });
  } catch (error) {
    console.log(error);
    var errors = [];
    for (field in error.errors) {
      errors.push(error.errors[field].message);
    }
    return res.json({ status: 0, errors: errors });
  }
});

//delete
router.get('/delete/:id', async (req, res) => {
  let id = req.params.id;
  try {
      var notification = await Notifications.deleteOne({ _id: id });
      if (notification) {
          await NotificationChild.deleteMany({notification_id:id});
          return res.json({ status:1,message:"Deleted successfully!"});
      } else {
          return res.json({ status: 0, message: "Could not delete proeprty type!" });
      }
  } catch (err) {
      console.log(err)
      return res.json({message:'couldnot delete',err});
  }
});

router.get("/resendnotification/notify",async(req,res)=>{
  let id = req.query.id;
  let notification = await Notifications.findOne({_id:id});
  if(notification){
    let user = await NotificationChild.findOne({notification_id:notification._id}).populate('user_id');
    // return res.json(user);
    let activity = "";
    let data_arg = {};
    if(typeof user != "undefined" && user != null){
      console.log('here inside user');
      if(typeof user.user_id != 'undefined'){
        switch(notification.notification_type){
          case 'EXTEND':
            activity = ".ReBookingActivity";
            data_arg ={
              type: "REBOOKING",
              book_id: notification.book_id
            }
            break;
          case 'BOOKED':
            activity = ".DashBoardActivity";
            data_arg = {
              type: "BOOK_NOTIFY",
              book_id: notification.book_id
            }
            break;
          case 'REVIEW':
            activity = ".DashBoardActivity"
            data_arg = {
              type: "REVIEW",
              book_id:notification.book_id,
              property_name:notification.property_name,
              property_id:notification.property_id
            }
            break;
        }
        if (user.user_id.device_type == "ios" && user.user_id.device_token) {
          var fcm = new FCM(config.fcm_server_key);
          var message = {
            to: user.user_id.device_token,
            priority: "high",
            notification: {
              title:notification.title,
              body: notification.description,
              priority: "high",
              badge: 0
            },
            data:data_arg
          };
        } else {
          var fcm = new FCM(config.fcm_server_key_android);
          var message = {
            to: user.user_id.device_token,
            priority: "high",
            notification: {
              title: notification.title,
              body: notification.description,
              priority: "high",
              badge: 0,
              click_action: activity
            },
            data:data_arg
          };
        }
        fcm.send(message, function(err, response) {
          if (err) {
            console.log("Something has gone wrong!", err);
          } else {
            console.log("Successfully sent with response: ", response);
          }
        });
        return res.json({status:true});
      }
    }
    
  }
  return res.json({status:false});

});
module.exports = router;
