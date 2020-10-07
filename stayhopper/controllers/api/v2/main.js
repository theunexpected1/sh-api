const express = require("express");
const router = express.Router();
const config = require("config");
const jwtMiddleware = require("../../../middleware/jwt");

// Services
const propertiesServices = require("../../../services/properties")

router.post("/authorized", jwtMiddleware.userAuthenticationRequired, (req, res) => {
  console.log('Success');
  res.status(200).json({});
})

router.post("/city", async (req, res) => {
  const body = req.body;
  try {
    if (
      !body ||
      !body.cityId
    ) {
      throw new Error('Invalid params');
    }

    const avgRateOfACity = await propertiesServices.getAvgNightlyRateForCity({
      cityId: body.cityId || ''
    });

    return res
      .status(200)
      .json({
        status: 1,
        data: avgRateOfACity
      })
    ;
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      e: e && e.message ? e.message : e
    }).end();
  }
}),


router.post("/cities", async (req, res) => {
  const body = req.body;
  try {
    const avgRatesOfCitiesOfACountry = await propertiesServices.getAvgNightlyRateForCitiesOfACountry({
      countryId: body && body.countryId
        ? body.countryId
        : config.countryId.UAE
    });

    return res
      .status(200)
      .json({
        status: 1,
        data: avgRatesOfCitiesOfACountry
      })
    ;
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      e: e && e.message ? e.message : e
    }).end();
  }
}),

router.get("/offers", async (req, res) => {
  return res
    .status(200)
    .json({
      status: 1,
      data: [{
        title: 'Visit The Bahamas',
        subtitle: 'Flat 30% off',
        image: 'https://extranet.stayhopper.com/public/files/properties/file-1550736145891.jpg',
        link: 'https://media.makeameme.org/created/so-sal-got.jpg',
      }, {
        title: 'AED 100 off',
        subtitle: 'For your first Booking',
        image: 'https://extranet.stayhopper.com/public/files/properties/file-1550736145891.jpg',
        link: 'https://media.makeameme.org/created/so-sal-got.jpg',
      }, {
        title: 'Visit The Bahamas',
        subtitle: 'Flat 30% off',
        image: 'https://extranet.stayhopper.com/public/files/properties/file-1550736145891.jpg',
        link: 'https://media.makeameme.org/created/so-sal-got.jpg',
      }, {
        title: 'AED 100 off',
        subtitle: 'For your first Booking',
        image: 'https://extranet.stayhopper.com/public/files/properties/file-1550736145891.jpg',
        link: 'https://media.makeameme.org/created/so-sal-got.jpg',
      }]
    })
  ;
});

router.get("/hotels-cheapest", async (req, res) => {
  try {
    const cheapestPropertiesResult = await propertiesServices.getCheapestProperties({});
    return res
      .status(200)
      .json({
        status: 1,
        data: cheapestPropertiesResult.list
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

router.get("/hotels-popular", async (req, res) => {
  const body = req.body;
  try {
    const popularPropertiesResult = await propertiesServices.getPopularProperties({});
    return res
      .status(200)
      .json({
        status: 1,
        data: popularPropertiesResult.list
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
