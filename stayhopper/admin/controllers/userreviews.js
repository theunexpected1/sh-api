const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");
const paginate = require("express-paginate");

const UserRating = require("../../db/models/userratings");
const Property = require("../../db/models/properties");
const Rating = require("../../db/models/userratings");

///user review listing
router.get("/", paginate.middleware(10, 50), async (req, res) => {
  let active_page = 1;
  if (req.query.page) {
    active_page = req.query.page;
  }
  const [userreviews, itemCount] = await Promise.all([
    UserRating.find()
      .populate("property")
      .populate("user")
      .sort({ _id: -1 })
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
    UserRating.find().count()
  ]);
  console.log(userreviews);
  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    userreviews: userreviews,
    itemCount: itemCount,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    active_page: active_page
  };
  res.render("admin/userreviews/list", data);
});

//Approve review
router.post("/approved", async (req, res) => {
  let id = req.body.id;
  if (id) {
    let userreviews = await UserRating.findOne({ _id: id });
    if (userreviews) {
      let status = 1;
      if (userreviews.approved == true) {
        userreviews.approved = false;
        status = 2;
      } else {
        userreviews.approved = true;
        status = 1;
      }
      await userreviews.save();
      if (userreviews._id) {
        let property = await Property.findOne({ _id: userreviews.property });
        let ratingfilter = [{ $match: { property: db.Types.ObjectId(userreviews.property) } }];
        ratingfilter.push(
          {
            $match:{approved:{$eq:true}}
          },
          {
            $group: {
              _id: null,
              count: {
                $sum: 1
              },
              value: {
                $sum: "$value"
              }
            }
        });
        let ratings = await Rating.aggregate(ratingfilter);
        if (ratings.length > 0) {
          let userrating = ratings[0].value / ratings[0].count;
          var number = userrating;
          var rounded = Math.round(number * 10) / 10;
          property.user_rating = rounded;
          await property.save();
        }else{
          property.user_rating = 0;
          await property.save();
        }
      }

      await userreviews.save();
      return res.json({ status: status, message: "updated" });
    } else {
      return res.json({ status: 0, message: "Could not update" });
    }
  } else {
    return res.json({ status: 0, message: "Could not update" });
  }
});
module.exports = router;
