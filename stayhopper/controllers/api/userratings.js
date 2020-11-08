const express = require("express");
const db = require("mongoose");
const router = express.Router();

const Rating = require("../../db/models/userratings");
const Property = require("../../db/models/properties");
const jwtMiddleware = require('../../middleware/jwt');

router.post("/", jwtMiddleware.userAuthenticationRequired, async (req, res) => {
  rating = new Rating();
  rating.user = req.user._id;
  rating.property = req.body.property;
  rating.comment = req.body.comment;
  rating.ub_id  = req.body.ub_id;
  rating.booking_id = req.body.booking_id;
  rating.value = Math.round(req.body.value) || 1;
  rating.date = new Date();
  try {
    await rating.save();
  } catch (error) {
    console.log(error);
    return res.json({
      status: "Failed",
      message: "Rating details could not save"
    });
  }
  return res.json({
    status: "Success",
    message: "Rating details saved successfully"
  });

  // if (rating._id) {
  //   let property = await Property.findOne({ _id: req.body.property });
  //   let ratings = await Rating.aggregate([
  //     { $match: { property: db.Types.ObjectId(req.body.property) } },
  //     {
  //       $group: {
  //         _id: null,
  //         count: {
  //           $sum: 1
  //         },
  //         value: {
  //           $sum: "$value"
  //         }
  //       }
  //     }
  //   ]);
  //   if (ratings.length > 0) {
  //     let userrating = ratings[0].value / ratings[0].count;
  //     var number = userrating;
  //     var rounded = Math.round(number * 10) / 10;
  //     property.user_rating = rounded;
  //     await property.save();
  //     return res.json({
  //       status: "Success",
  //       message: "Rating details saved successfully"
  //     });
  //   } else {
  //     await rating.remove();
  //     return res.json({
  //       status: "Failed",
  //       message: "Rating details could not save"
  //     });
  //   }
  // }
});

router.post("/report", async (req, res) => {
  return res.json({
    status: "Success",
    message: "Report submitted successfully"
  });
});

module.exports = router;
