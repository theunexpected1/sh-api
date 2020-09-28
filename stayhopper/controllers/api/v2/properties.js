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

    const properties = await propertiesServices.getAvailableProperties({
      checkinDate: body.checkinDate,
      checkoutDate: body.checkoutDate,
      checkinTime: body.checkinTime,
      checkoutTime: body.checkoutTime,
      bookingType: body.bookingType || 'hourly', // hourly or monthly
      cityId: body.cityId || '',
      countryId: body.countryId || '',
      numberAdults: body.numberAdults || 2,
      numberChildren: body.numberChildren || 0,
      numberRooms: body.numberRooms || 1,
      properties: body.properties || []
    });

    return res
      .status(200)
      .json({
        status: 1,
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


module.exports = router;
