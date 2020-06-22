const db = require("../../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const generator = require("generate-password");
const path = require("path");
const paginate = require("express-paginate");

const Users = require("../../db/models/users");
const UserBooking = require("../../db/models/userbookings");
const CompletedBooking = require("../../db/models/completedbookings");

router.get("/", paginate.middleware(10, 50), async (req, res) => {
  let active_page = 1;
  if(req.query.page){
    active_page = req.query.page;
  }
  let [users, itemCount] = await Promise.all([
    Users.find({})
      .sort({ name: 1 })
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
    Users.count({})
  ]);
  for(var i=0; i< users.length; i++){
    let sum = await UserBooking.aggregate([
      { $match: { user: users[i]._id } },
      {
        $group: {
          _id: "$user",
          totalAmount: { $sum: "$total_amt" },
          count: { $sum: 1 }
        }
      }
    ]);
    let totalAmt = 0;
    let count = 0;
    if (sum.length>0) {
      totalAmt = sum[0].totalAmount;
      count = sum[0].count;
    }
    users[i].totalAmt = totalAmt||0;
    users[i].count = count||0;

    let sum2 = await CompletedBooking.aggregate([
      { $match: { user: users[i]._id } },
      {
        $group: {
          _id: "$user",
          totalAmount: { $sum: "$total_amt" },
          count: { $sum: 1 }
        }
      }
    ]);
    totalAmt = 0;
    count = 0;
    if (sum2.length>0) {
      totalAmt = sum2[0].totalAmount;
      count = sum2[0].count;
    }
    users[i].totalAmt += totalAmt||0;
    users[i].count += count||0;
  }
  // return res.json(users);
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    users,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    pageCount,
    itemCount,
    active_page
  };
  res.render("admin/users/list", data);
});
//view
router.get("/view/:id", paginate.middleware(10, 50), async (req, res) => {
  let result = await Users.findOne({ _id: req.params.id });
  where = {user:req.params.id}
  let bookings = await UserBooking.find(where)
    .sort({ date_checkin: -1 })
    .populate("property")
    .populate({
      path: "room.room",
      populate: [{ path: "room_name" }]
    })
    .limit(req.query.limit)
    .skip(req.skip)
    .lean()
    .exec();
  let itemCount = await UserBooking.find(where).count({});
  console.log(itemCount);
  const pageCount = Math.ceil(itemCount / req.query.limit);

  let totalAmt = 0;
  let count = 0;
  if (result) {
    let sum = await UserBooking.aggregate([
      { $match: { user: result._id } },
      {
        $group: {
          _id: "$user",
          totalAmount: { $sum: "$total_amt" },
          count: { $sum: 1 }
        }
      }
    ]);
    if (sum.length>0) {
      totalAmt = sum[0].totalAmount;
      count = sum[0].count;
    }
    let sum2 = await CompletedBooking.aggregate([
      { $match: { user: result._id } },
      {
        $group: {
          _id: "$user",
          totalAmount: { $sum: "$total_amt" },
          count: { $sum: 1 }
        }
      }
    ]);
    if (sum2.length>0) {
      totalAmt += sum2[0].totalAmount||0;
      count += sum2[0].count||0;
    }
  }
  let data = {
    result,
    bookings,
    totalAmt,
    itemCount,
    pageCount,
    count,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page)
  };
  res.render("admin/users/view", data);
});

router.get("/view/completed/:id", paginate.middleware(10, 50), async (req, res) => {
  let result = await Users.findOne({ _id: req.params.id });
  where = {user:req.params.id}
  let bookings = await CompletedBooking.find(where)
    .sort({ date_checkin: -1 })
    .limit(req.query.limit)
    .skip(req.skip)
    .lean()
    .exec();
  let itemCount = await CompletedBooking.find(where).count({});
  console.log(itemCount);
  const pageCount = Math.ceil(itemCount / req.query.limit);

  let totalAmt = 0;
  let count = 0;
  if (result) {
    let sum = await UserBooking.aggregate([
      { $match: { user: result._id } },
      {
        $group: {
          _id: "$user",
          totalAmount: { $sum: "$total_amt" },
          count: { $sum: 1 }
        }
      }
    ]);
    if (sum.length>0) {
      totalAmt = sum[0].totalAmount;
      count = sum[0].count;
    }
    let sum2 = await CompletedBooking.aggregate([
      { $match: { user: result._id } },
      {
        $group: {
          _id: "$user",
          totalAmount: { $sum: "$total_amt" },
          count: { $sum: 1 }
        }
      }
    ]);
    if (sum2.length>0) {
      totalAmt += sum2[0].totalAmount||0;
      count += sum2[0].count||0;
    }
  }
  let data = {
    result,
    bookings,
    totalAmt,
    itemCount,
    pageCount,
    count,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page)
  };
  res.render("admin/users/completed_view", data);
});
//status
router.post("/status/:id", async (req, res) => {
  const user = await Users.findOne({ _id: req.params.id });
  if (user.status == "Enable") {
    var stat = "Disable";
  } else {
    var stat = "Enable";
  }
  user.status = stat;
  try {
    var result = await user.save();
  } catch (err) {
    console.log(err);
  }
});
//delete
router.get("/delete/:id", async (req, res) => {
  var result = await Users.deleteOne({ _id: req.params.id });
  if (result) {
    return res.status(200).json({ status: 1 });
  } else {
    console.log(error);
    return res.status(200).json({ status: 0 });
  }
});
module.exports = router;
