router.post("/search", async (req, res) => {
    let lat = 0;
    let lng = 0;
    let checkin_date = req.body.checkin_date;
    let checkin_time = req.body.checkin_time;
    let selected_hours = req.body.selected_hours;
    //filter data
    let tmp_price = req.body.price;
    let filter_price = [];
    if (tmp_price) {
      filter_price = tmp_price.split(",");
    }
    let tmp_service = req.body.service;
    let filter_service = null;
    if (tmp_service) {
      filter_service = tmp_service;
    }
    let tmp_rating = req.body.sort_rating;
    let sort_rating = 0;
    if (tmp_rating) {
      sort_rating = -1; // parseInt(tmp_rating);
    }
    let rating = req.body.rating;
    //end filter data
    let requested_slot = await Slot.findOne({ label: checkin_time });
    let from = 0;
    let to = 0;
    let number_rooms = req.body.number_rooms;
    let city = req.body.city;
    if (requested_slot) {
      from = parseInt(requested_slot.no);
      to = selected_hours * 2;
    }
    let requested_slots = await Slot.find()
      .select("_id")
      .skip(from)
      .limit(to);
  
    let requested_slots2 = null;
    let checkin_date2 = null;
    if (requested_slots.length < to) {
      let balance_slots = requested_slots.length - to;
      requested_slots2 = await Slot.find()
        .select("_id")
        .limit(balance_slots);
      tmp_date = new Date(checkin_date);
      checkin_date2 = moment(tmp_date)
        .add(1, "days")
        .format("YYYY-MM-DD");
    }
  
    if (req.body.location) {
      let tmp_loc = req.body.location.split(",");
      lat = tmp_loc[0];
      lng = tmp_loc[1];
    }
    let selected_slots = [];
    for (var i = 0; i < requested_slots.length; i++) {
      selected_slots.push(requested_slots[i]._id.toString());
    }
    let selected_slots2 = [];
    if (requested_slots2) {
      for (var i = 0; i < requested_slots2.length; i++) {
        selected_slots2.push(requested_slots2[i]._id.toString());
      }
    }
    let filter = [
      {
        $lookup: {
          from: "rooms",
          localField: "_id",
          foreignField: "property_id",
          as: "rooms"
        }
      },
      {
        $lookup: {
          from: "property_ratings",
          localField: "rating",
          foreignField: "_id",
          as: "rating_dic"
        }
      },
      {
        $addFields: {
          timeslot_exists: {
            $in: [parseInt(selected_hours), "$timeslots"]
          }
        }
      },
      {
        $match: {
          timeslot_exists: true
        }
      }
    ];
    if (city) {
      filter.push({
        $match: {
          "contactinfo.city": db.Types.ObjectId(city)
        }
      });
    } else {
      filter.push({
        $match: {
          "contactinfo.latlng": {
            $geoWithin: {
              $centerSphere: [[parseInt(lat), parseInt(lng)], 40 / 3963.2]
            }
          }
        }
      });
    }
    if (sort_rating) {
      filter.push({
        $sort: {
          "rating_dic.value": sort_rating
        }
      });
    }
    if (rating) {
      let rating_id = db.Types.ObjectId(rating);
      filter.push({ $match: { rating: rating_id } });
    }
    properties = await Property.aggregate(filter);
    // return res.json({properties,filter});
    let available_properties = [];
    let available_properties2 = [];
    let available_properties_id = [];
    let available_properties2_id = [];
    for (i = 0; i < properties.length; i++) {
      let rooms = properties[i].rooms;
      let available_rooms = 0;
      if (rooms && rooms.length > 0) {
        for (var j = 0; j < properties[i].rooms.length; j++) {
          let custom_price = await Price.findOne({
            $and: [
              { room: db.Types.ObjectId(properties[i].rooms[j]._id) },
              { from: { $lte: new Date(checkin_date) } },
              { to: { $gte: new Date(checkin_date) } }
            ]
          }).sort({ _id: -1 });
          if (custom_price) {
            properties[i].rooms[j].custom_price = custom_price;
          }
        }
        let available_rooms = await is_available(
          rooms,
          checkin_date,
          selected_slots,
          filter_price,
          filter_service,
          selected_hours
        );
        if (available_rooms) {
          if (number_rooms <= available_rooms) {
            if (properties[i].approved != false) {
              available_properties_id.push(properties[i]._id);
            }
          }
        }
        if (requested_slots2 && requested_slots2.length > 0) {
          let available_rooms = await is_available(
            rooms,
            checkin_date2,
            selected_slots2,
            filter_price,
            filter_service
          );
          if (available_rooms) {
            if (number_rooms <= available_rooms) {
              if (properties[i].approved != false) {
                available_properties2_id.push(properties[i]._id);
              }
            }
          }
          available_properties_id = _.intersection(
            available_properties_id,
            available_properties2_id
          );
        }
      }
    }
    if (available_properties_id.length > 0) {
      available_properties = properties.filter(function(property) {
        return _.contains(available_properties_id, property._id);
      });
    }
    if (available_properties.length > 0) {
      return res.json({ status: "Success", data: available_properties });
    } else {
      return res.json({ status: "Failed", message: "No data" });
    }
  });