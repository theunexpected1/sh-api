const express = require("express");
const router = express.Router();

const jwtMiddleware = require("../../../middleware/jwt");

// Services
const propertiesServices = require("../../../services/properties")

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
  // const body = req.body;
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

module.exports = router;
