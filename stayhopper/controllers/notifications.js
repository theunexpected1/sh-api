const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();

const Notification = require('../db/models/notifications');
const NotificationChild = require('../db/models/notification_childs');
const User = require('../db/models/users')

router.get('/', async (req, res) => {
    let notifications = await Notification.find()
    let data = {
        'notifications': notifications,
    }
    res.render('notifications/list', data);
});

//insert
router.post('/', async (req, res) => {
    let title = req.body.title;
    let description = req.body.description;
    if (!title) {
        return res.json({ status: 0, message: "Title is required" });
    }
    if (!description) {
        return res.json({ status: 0, message: "Description is required" });
    }
    let notification = new Notification();
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
       
        return res.json({
            status: 1,
            message: "Notification Added successfully!",
            id: notification._id
        });
    } catch (error) {
        console.log(error)
        var errors = [];
        for (field in error.errors) {
            errors.push(error.errors[field].message);
        }
        return res.json({ status: 0, errors: errors });
    }
})
//edit
router.get("/:id", async (req, res) => {
    let id = req.params.id;
    let notification = await Notification.findOne({ _id: id });
    if (notification) {
        return res.json({ status: 1, data: notification });
    } else {
        return res.json({ status: 0, message: "No data" });
    }
});

//update
router.post('/update', async (req, res) => {
    let notification = await Notification.findOne({ _id: req.body.id });
    notification.title = req.body.title;
    notification.description = req.body.description;
    try {
        await notification.save();
        return res.json({
            status: 1,
            message: "Notification Updated successfully!",
            id: notification._id
        });
    } catch (error) {
        console.log(error)
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
        var notification = await Notification.deleteOne({ _id: id });
        if (notification) {
            await NotificationChild.deleteMany({notification_id:id});
            return res.json({ status:1,message:"Deleted successfully!"});
        } else {
            return res.json({ status: 0, message: "Could not delete proeprty type!" });
        }
    } catch (err) {
        console.log(err)
    }
});
module.exports = router;