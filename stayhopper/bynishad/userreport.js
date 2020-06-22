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
const moment = require("moment");

const Users = require("../../db/models/users");
const Property = require("../../db/models/properties");

router.get("/", paginate.middleware(5, 50), async (req, res) => {
  let active_page = 1;
  if(req.query.page){
    active_page = req.query.page;
  }
  let [users, itemCount] = 	await Promise.all([
		Users.aggregate([
			{
				$lookup:
				{
					from: "completed_bookings",
					localField: "_id",
					foreignField: "user",
					as: "user_bookings"
				}
			}, {
				$project: {
					"name": "$name",
					"count": {
						$size: "$user_bookings"
					}
				}
			}, {
				$match: {
					count: { $gt:0 }
				}
			}, {
				$sort: {
					count: -1
				}
			},
			//{ 
			// 	"$limit": 5 
			//}
		])
	]);
	
	let total_count = 0;
	let total_shrevenue = 0;
	for(var i=0; i< users.length; i++) {
		users[i].shrvenue = users[i].count * 15;
		
		total_count += users[i].count;
		total_shrevenue += users[i].shrvenue;
	}
	//return res.json(users);
	let data = {
		users,
		total_count,
		total_shrevenue
	};
	//return res.json(data);

	res.render("admin/userreport/list", data);
});

router.get("/pastbookings", async (req, res) => {
	let today = moment().add(-2,'days').format('YYYY-MM-DD');
	
	let [property, itemCount] = await Promise.all([
		Property.aggregate([
			{
				$lookup:
				{
					from: "bookinglogs",
					localField: "_id",
					foreignField: "property",
					as: "property_bookinglogs"
				}
			}, {
				$project: {
					"property_name": "$name",
					"count": {
						$size: "$property_bookinglogs"
					}
				}
			}, {
				$match: {
					count: { $gt:0 }
				}
			}, {
				$sort: {
					count: -1
				}
			},
			{ 
			 	"$limit": 100 
			}
		])
	]);
	return res.json(property);
	
	let data = {
		property
	};
	//return res.json(data);

	res.render("admin/userreport/pastbookings", data);
});

module.exports = router;
