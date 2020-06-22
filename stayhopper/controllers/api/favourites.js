const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const _ = require("underscore");
const db = require("mongoose");

const User = require("../../db/models/users");
const Price = require("../../db/models/pricing");
const Property = require("../../db/models/properties");
const moment = require('moment');

router.post("/", async (req, res) => {
  let property_id = req.body.property_id;
  let user_id = req.body.user_id;
  let user = await User.findOne({ _id: user_id });
  if (user) {
    let favourites = user.favourites;
    if (favourites.length > 0) {
      let temp = favourites.map((prop, index) => {
        if (prop == property_id) {
          user.favourites.pull(prop);
          return prop;
        } else {
          return null;
        }
      });
      temp = _.without(temp, null);
      if (temp.length > 0) {
        try {
          await user.save();
          return res.json({
            status: "Success",
            message: "Removed from favourites"
          });
        } catch (error) {
          return res.json({
            status: "Failed",
            message: "Could not remove from favourites"
          });
        }
      } else {
        user.favourites.push(property_id);
        try {
          await user.save();
          return res.json({
            status: "Success",
            message: "Marked as favourite"
          });
        } catch (error) {
          return res.json({
            status: "Failed",
            message: "Could not mark as favourite"
          });
        }
      }
    } else {
      user.favourites.push(property_id);
      try {
        await user.save();
        return res.json({ status: "Success", message: "Marked as favourite" });
      } catch (error) {
        return res.json({
          status: "Failed",
          message: "Could not mark as favourite"
        });
      }
    }
  }
});

router.post("/:id", async (req, res) => {
  let user_id = req.params.id;
  let user = await User.findOne({ _id: user_id }).lean().exec();
  let checkin_date = moment().format('YYYY-MM-DD');

  if(user){
    favourites = user.favourites;
    custom_pricings_raw = await Price.aggregate([ 
      {
        $match: {
          from: {
            $lte:new Date(checkin_date+" 00:00:00.000")
          },
          to: {
            $gte:new Date(checkin_date+" 00:00:00.000")
          }
        }
      },
      { 
        $sort : { 
          _id : -1
        } 
      },
      {
        $group : {
           _id : { room:'$room'},
           h3: {$addToSet:'$h3'},
           h6: {$addToSet:'$h6'},
           h12: {$addToSet:'$h12'},
           h24: {$addToSet:'$h24'},
        }
      },
      {
        $project:{
          room : '$_id.room',
          h3: { $arrayElemAt: [ "$h3", 0 ] },
          h6: { $arrayElemAt: [ "$h6", 0 ] },
          h12: { $arrayElemAt: [ "$h12", 0 ] },
          h24: { $arrayElemAt: [ "$h24", 0 ] }
        }
      }
    ]);
    // return res.json({custom_pricings_raw});
    custom_pricings = [];
    if(custom_pricings_raw.length > 0){
      for(var i=0;i<custom_pricings_raw.length;i++){
        let cust_price = {};
        cust_price['3'] = parseFloat(custom_pricings_raw[i].h3);
        cust_price['6'] = parseFloat(custom_pricings_raw[i].h6);
        cust_price['12'] = parseFloat(custom_pricings_raw[i].h12);
        cust_price['24'] = parseFloat(custom_pricings_raw[i].h24);
        custom_pricings.push(
          {
            room : custom_pricings_raw[i].room,
            price : cust_price
          }
        );
      }
    }

    let available_properties_filter = [];
    available_properties_filter.push(
      {
        $match:{
          _id:{
            $in:favourites
          }
        }
      },
      {
        $match: {
          "approved": true
        }
      },
      {
        $match: {
          "published": true
        }
      },
      {
        $lookup: {
          from: "rooms",
          localField: "rooms",
          foreignField: "_id",
          as: "room_details"
        }
      },
      {
        $lookup: {
          from: "property_ratings",
          localField: "rating",
          foreignField: "_id",
          as: "rating"
        }
      }
    );
    available_properties_filter.push(
      {
        $unwind: '$room_details'
      },
      { 
        $addFields: {
          services: {
           $cond: {
              if: {
                $ne: [ { "$type": "$room_details.services" }, "array" ]
              },
              "then": [],
              "else": "$room_details.services"
           }
          }
        }
      },
      {
        $project:
        {
          name: '$name',
          images: '$images',
          rating: '$rating',
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          room_id: '$room_details._id',
          number_rooms: '$room_details.number_rooms',
          room_detail: '$room_details',
          location : '$contactinfo.location',
          latlng : '$contactinfo.latlng',
          smallest_timeslot: {$min:'$timeslots'}
        }
      }
    );
    available_properties_filter.push(  
      { 
        $project: 
        { 
          name: '$name',
          images: '$images',
          rating: '$rating',
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          room_id : '$room_id',
          number_rooms : '$number_rooms',
          room_detail:'$room_detail',
          location : '$location',
          latlng : '$latlng',
          smallest_timeslot: '$smallest_timeslot'
        } 
      },
      {
        $addFields: {
          custom_pricings_array : custom_pricings
        }
      },
      { 
        $project: 
        { 
          name: '$name',
          images: '$images',
          rating: '$rating',
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          room_id : '$room_id',
          number_rooms : '$number_rooms',
          room_detail:'$room_detail',
          location : '$location',
          latlng : '$latlng',
          smallest_timeslot: '$smallest_timeslot',
          custom_pricings_array : {
            '$filter': {
              input: '$custom_pricings_array',
              as: 'custom_pricings_array',
              cond: { $eq: ['$$custom_pricings_array.room', '$room_id'] }
            }
          }
        } 
      },
      {
        $addFields: {
          custom_pricing : { $arrayElemAt: ["$custom_pricings_array", 0] },
        }
      },
      { 
        $project: 
        { 
          name: '$name',
          images: '$images',
          rating: { $arrayElemAt: ["$rating", 0] },
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          room_id : '$room_id',
          number_rooms : '$number_rooms',
          room_detail:'$room_detail',
          default_price: {
            $switch:
              {
                branches: [
                  {
                    case: { $eq: [ "$smallest_timeslot", 3 ] },
                    then: "$room_detail.price.h3"
                  },
                  {
                    case: { $eq: [ "$smallest_timeslot", 6 ] },
                    then: "$room_detail.price.h6"
                  },
                  {
                    case: { $eq: [ "$smallest_timeslot", 12 ] },
                    then: "$room_detail.price.h12"
                  },
                  {
                    case: { $eq: [ "$smallest_timeslot", 24 ] },
                    then: "$room_detail.price.h24"
                  }
                ],
                default: null
              }
          },
          smallest_timeslot:'$smallest_timeslot',
          custom_price:{
            $switch:
              {
                branches: [
                  {
                    case: { $eq: [ "$smallest_timeslot", 3 ] },
                    then: "$custom_pricing.price.3"
                  },
                  {
                    case: { $eq: [ "$smallest_timeslot", 6 ] },
                    then: "$custom_pricing.price.6"
                  },
                  {
                    case: { $eq: [ "$smallest_timeslot", 12 ] },
                    then: "$custom_pricing.price.12"
                  },
                  {
                    case: { $eq: [ "$smallest_timeslot", 24 ] },
                    then: "$custom_pricing.price.24"
                  }
                ],
                default: null
              }
          },
          location : '$location',
          latlng : '$latlng',
        } 
      },
      { 
        $addFields:{
          current_price: { $ifNull: [ "$custom_price", "$default_price" ] }
        } 
      }
    )
    available_properties_filter.push(
      {
        $project:{ 
          name: '$name',
          images: '$images',
          rating: "$rating",
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          smallest_timeslot:'$smallest_timeslot',
          rooms:{
            _id:'$room_id',
            price:'$default_price',
            custom_price:'$custom_price',
            current_price: '$current_price'
          },
          contactinfo:{
            location : '$location',
            latlng : '$latlng'
          }
        } 
      },
      {
        $match:{
          'rooms.current_price':{$gte:0}
        }
      },
      {
        $sort:{
          'rooms.current_price':-1
        }
      }
    );
  
    available_properties_filter.push(
      {
        $group : {
          _id:{property:'$_id'},
          name: {$addToSet:'$name'},
          images: {$addToSet:'$images'},
          rating: {$addToSet:'$rating'},
          timeslots: {$addToSet:'$timeslots'},
          smallest_timeslot: {$addToSet:'$smallest_timeslot'},
          user_rating: {$addToSet:'$user_rating'},
          rooms:{$addToSet:'$rooms'},
          contactinfo: {$addToSet:'$contactinfo'},
          minprice: { $min: "$rooms.current_price" },
          maxprice: { $max: "$rooms.current_price" }
        }
      },
      {
        $project : {
          _id:'$_id.property',
          name: { $arrayElemAt: ["$name", 0] },
          images: { $arrayElemAt: ["$images", 0] },
          rating: { $arrayElemAt: ["$rating", 0] },
          timeslots: { $arrayElemAt: ["$timeslots", 0] },
          smallest_timeslot: { $arrayElemAt: ["$smallest_timeslot", 0] },
          user_rating: { $arrayElemAt: ["$user_rating", 0] },
          rooms: '$rooms',
          contactinfo: { $arrayElemAt: ["$contactinfo", 0] },
          minprice: "$minprice",
          maxprice: "$maxprice"
        }
      },
      {
        $sort:{
          distance: 1
        }
      },
      {
        $sort:{
          user_rating: -1
        }
      }
    );
    let available_properties = await Property.aggregate(available_properties_filter);
    if (available_properties.length > 0) {
      return res.json({ status: "Success", data: available_properties });
    } else {
      return res.json({ status: "Failed", message: "No data" });
    }
  }else{
    return res.json({'status':'Failed','message':'No data'});
  }
});
module.exports = router;
