const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();

const Notifications = require("../../db/models/notifications");
const NotificationChild = require("../../db/models/notification_childs");

router.get("/", async (req, res) => {
  return res.json({ status: "Failed", message: "Notifications not found" });
});

router.get("/new", async (req, res) => {
  let user_id = req.query.user_id;
  try {
    if (user_id) {
      let notifications = await NotificationChild.aggregate([
        {
          $match: {
            user_id: db.Types.ObjectId(user_id)
          }
        },
        {
          $sort: {
            read_status: 1,
            _id: -1
          }
        },
        {
          $lookup: {
            from: "notifications",
            localField: "notification_id",
            foreignField: "_id",
            as: "notification"
          }
        },
        {
          $project: {
            _id: "$_id",
            read_status: "$read_status",
            user_id: "$user_id",
            notification_id: "$notification_id",
            notification_type: {
              $arrayElemAt: ["$notification.notification_type", 0]
            },
            title: { $arrayElemAt: ["$notification.title", 0] },
            body: { $arrayElemAt: ["$notification.description", 0] },
            book_id: { $arrayElemAt: ["$notification.book_id", 0] },
            booking_no: { $arrayElemAt: ["$notification.booking_no", 0] },
            property_name: { $arrayElemAt: ["$notification.property_name", 0] },
            property_id: { $arrayElemAt: ["$notification.property_id", 0] }
          }
        }
      ]);
      if (notifications) {
        return res.json({ status: "Success", data: notifications });
      } else {
        return res.json({
          status: "Failed",
          message: "Notifications not found"
        });
      }
    }else{
        return res.json({
            status: "Failed",
            message: "Notifications not found"
        });
    }
  } catch (err) {
    return res.json({ status: "Failed", message: err.message });
  }
});

router.post("/read", async (req, res) => {
  id = req.body.id;
  await NotificationChild.update({ _id: id }, { $set: { read_status: true } });
  return res.json({
    status: "Success",
    message: "Notification read successfully!"
  });
});

router.get("/notification_count", async (req, res) => {
  let user_id = req.query.user_id;
  try {
    let notifications = await NotificationChild.aggregate([
      {
        $match: {
          user_id: db.Types.ObjectId(user_id),
          read_status: false
        }
      },
      {
        $sort: {
          _id: 1,
          read_status: 1
        }
      },
      {
        $lookup: {
          from: "notifications",
          localField: "notification_id",
          foreignField: "_id",
          as: "notification"
        }
      },
      {
        $project: {
          _id: "$_id",
          read_status: "$read_status",
          user_id: "$user_id",
          notification_id: "$notification_id",
          notification_type: {
            $arrayElemAt: ["$notification.notification_type", 0]
          },
          title: { $arrayElemAt: ["$notification.title", 0] },
          body: { $arrayElemAt: ["$notification.description", 0] },
          book_id: { $arrayElemAt: ["$notification.book_id", 0] },
          booking_no: { $arrayElemAt: ["$notification.booking_no", 0] },
          property_name: { $arrayElemAt: ["$notification.property_name", 0] },
          property_id: { $arrayElemAt: ["$notification.property_id", 0] }
        }
      }
    ]);
    if (notifications) {
      return res.json({ status: "Success", count: notifications.length });
    } else {
      return res.json({ status: "Success", count: 0 });
    }
  } catch (err) {
    return res.json({ status: "Success", count: 0 });
  }
});

module.exports = router;
