const express = require("express");
const router = express.Router();
const jwtMiddleware = require("../../../middleware/jwt");
const Property = require("../../../db/models/properties");
const db = require("../../../db/mongodb");

// Services
const propertiesServices = require("../../../services/properties")
const checkinService = require("../../../services/checkin")

router.post("/authorized", jwtMiddleware.userAuthenticationRequired, (req, res) => {
  console.log('Success');
  res.status(200).json({});
})

router.post("/search", async (req, res) => {
  const body = req.body;
  const timezone = req.timezone;

  try {
    if (
      !body ||
      !body.checkinDate ||
      !body.checkoutDate ||
      !body.checkinTime ||
      !body.checkoutTime
    ) {
      throw new Error('Invalid params');
    }

    const properties = await propertiesServices.getProperties({
      checkinDate: body.checkinDate.replace(/-/g, '/'),
      checkoutDate: body.checkoutDate.replace(/-/g, '/'),
      checkinTime: body.checkinTime,
      checkoutTime: body.checkoutTime,
      bookingType: body.bookingType || 'hourly', // hourly or monthly
      location: body.location || '',
      cityId: body.cityId || '',
      countryId: body.countryId || '',
      numberAdults: parseInt(body.numberAdults) || 2,
      numberChildren: parseInt(body.numberChildren) || 0,
      numberRooms: parseInt(body.numberRooms) || 1,
      properties: body.properties || '',
      rooms: body.rooms || '',
      isTestingRates: body.isTestingRates || false,
      limit: body.limit || '',
      sort: body.sort || '',
      orderBy: body.orderBy || '',
      // Filters
      priceMin: body.priceMin || null,
      priceMax: body.priceMax || null,
      propertyTypes: body.propertyTypes || '',
      propertyRatings: body.propertyRatings || '',
      roomTypes: body.roomTypes || '',
      bedTypes: body.bedTypes || '',
      amenities: body.amenities || '',
      timezone
    });

    return res
      .status(200)
      .json({
        data: properties
      })
    ;
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      e: e && e.message ? e.message : e
    }).end();
  }
});

router.get("/filters", async (req, res) => {
  try {
    const filters = await propertiesServices.getFilters();
    return res
      .status(200)
      .json({
        data: filters
      })
    ;
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      e: e && e.message ? e.message : e
    }).end();
  }
})

// Get Property detail
router.get("/:id", async (req, res) => {
  const body = req.body;
  const params = req.params;
  const timezone = req.timezone;

  try {
    const propertyPopulations = [
      // currency
      { $lookup: { from: "currencies", localField: "currency", foreignField: "_id", as: "currency" }},
      { $unwind: "$currency"},

      // rating
      { $lookup: { from: "property_ratings", localField: "rating", foreignField: "_id", as: "rating" }},
      { $unwind: "$rating"},

      // contactinfo.country
      { $lookup: { from: "countries", localField: "contactinfo.country", foreignField: "_id", as: "contactinfo.country" }},
      { $unwind: "$contactinfo.country"},

      // contactinfo.city
      { $lookup: { from: "cities", localField: "contactinfo.city", foreignField: "_id", as: "contactinfo.city" }},
      { $unwind: "$contactinfo.city"},

      // propertyTypes
      { $lookup: { from: "property_types", localField: "type", foreignField: "_id", as: "type" }},
      { $unwind: "$type"},

      // policies
      { $lookup: { from: "privacy_policies", localField: "policies", foreignField: "_id", as: "policies" }},

      // services
      { $lookup: { from: "services", localField: "services", foreignField: "_id", as: "services" }},

      // userRatings > Approved
      { $lookup: {
        from: "userratings",
        let: { propertyId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$property", "$$propertyId"], $eq: ["$approved", true] } }},
          { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" }},
          { $unwind: "$user"},
          { $project: {
            booking_id: 1,
            comment: 1,
            value: 1,
            date: 1,
            'user.name': 1,
            'user.image': 1,
            'user.email': 1,
            'user.mobile': 1,
            'user.country': 1
          }}
        ],
        as: "userRatings"
      }}
    ];

    const roomPopulations = [
      { $lookup: {
        from: "rooms",
        let: { propertyId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$property_id", "$$propertyId"]}} },

          // Guest Numbers
          { $lookup: { from: "guest_numbers", localField: "number_of_guests", foreignField: "_id", as: "number_of_guests" }},
          { $unwind: "$number_of_guests" },

          // Room type
          { $lookup: { from: "room_types", localField: "room_type", foreignField: "_id", as: "room_type" }},
          { $unwind: "$room_type" },

          // Room name
          { $lookup: { from: "room_names", localField: "room_name", foreignField: "_id", as: "room_name" }},
          { $unwind: "$room_name" },

          // Bed type
          { $lookup: { from: "bed_types", localField: "bed_type", foreignField: "_id", as: "bed_type" }},
          { $unwind: "$bed_type" },

          // Services
          { $lookup: { from: "services", localField: "services", foreignField: "_id", as: "services" }},

          { $project: {
            images: 1,
            featured: 1,
            room_type: 1,
            number_rooms: 1,
            custom_name: 1,
            bed_type: 1,
            services: 1,
            number_of_guests: 1,
            room_size: 1
          }}
        ],
        as: "rooms"
      }}
    ];

    const projections = [{
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        distance: 1,
        location: 1,
        images: 1,
        featured: 1,
        currency: 1,
        rooms: 1,
        'contactinfo.country': 1,
        'contactinfo.city': 1,
        rating: 1,
        type: 1,
        policies: 1,
        services: 1,
        nearby: 1,
        userRatings: 1
      }
    }];

    const match = [{ $match: { _id: db.Types.ObjectId(params.id) } }]

    // 1. Get the matching property with all populations
    const propertyAggregation = await Property.aggregate([
      ...propertyPopulations,
      ...roomPopulations,
      ...match,
      ...projections,
    ])

    // Pick first from list
    const propertyDetails = propertyAggregation && propertyAggregation.length
      ? propertyAggregation[0]
      : {}
    ;

    const checkinDate = body.checkinDate ? body.checkinDate.replace(/-/g, '/') : '';
    const checkoutDate = body.checkoutDate ? body.checkoutDate.replace(/-/g, '/') : '';
    const checkinTime = body.checkinTime;
    const checkoutTime = body.checkoutTime;
    // 2. Get Property Room Rates
    const propertiesWithRoomRates = await propertiesServices.getProperties({
      checkinDate,
      checkoutDate,
      checkinTime,
      checkoutTime,
      bookingType: body.bookingType || 'hourly', // hourly or monthly
      numberAdults: parseInt(body.numberAdults) || 2,
      numberChildren: parseInt(body.numberChildren) || 0,
      numberRooms: parseInt(body.numberRooms) || 1,
      properties: params.id,
      timezone
    });

    // Pick first from list
    const propertyWithRoomRates = propertiesWithRoomRates && propertiesWithRoomRates.list && propertiesWithRoomRates.list.length
      ? propertiesWithRoomRates.list[0]
      : {}
    ;

    // 3. Merging the above 2
    // Property Details - populate pricing / inventory / guests capacity (if available)
    propertyDetails.priceSummary = propertyWithRoomRates.priceSummary || {};
    const propertyWithUserRating = await propertiesServices.getPropertyRating(propertyDetails);
    if (propertyWithUserRating && typeof propertyWithUserRating.userRating !== 'undefined') {
      propertyDetails.userRating = propertyWithUserRating.userRating;
    } else {
      propertyDetails.userRating = 0;
    }

    propertyDetails.numberOfRoomsAvailable = propertyWithRoomRates.numberOfRoomsAvailable || 0;
    propertyDetails.adultsCapacity = propertyWithRoomRates.adultsCapacity || 0;
    propertyDetails.childrenCapacity = propertyWithRoomRates.childrenCapacity || 0;
    propertyDetails.stayDuration = checkinService.getStayDuration({ checkinDate, checkoutDate, checkinTime, checkoutTime });

    // Property Details - Populate the Rooms with their pricing (if available)
    propertyDetails.rooms = propertyDetails.rooms || [];
    propertyWithRoomRates.rooms = propertyWithRoomRates.rooms || [];
    propertyDetails.rooms = propertyDetails.rooms.map(room => {
      // If we have pricing for a room, use that room instead
      // Otherwise populate the default inventory / guest information in the existing room
      const roomWithRates = propertyWithRoomRates.rooms.find(_room => _room._id.toString() === room._id.toString());
      return roomWithRates || propertiesServices.populateRoomsInventoryAndGuests(room);
    });

    // 3. Combine Property Details with the rates information
    return res
      .status(200)
      .json({
        data: propertyDetails
      })
    ;
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      e: e && e.message ? e.message : e
    }).end();
  }
});

module.exports = router;
