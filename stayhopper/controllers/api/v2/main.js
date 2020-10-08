const express = require("express");
const router = express.Router();
const config = require("config");
const jwtMiddleware = require("../../../middleware/jwt");

// Services
const propertiesService = require("../../../services/properties")
const offersService = require("../../../services/offers")

router.post("/authorized", jwtMiddleware.userAuthenticationRequired, (req, res) => {
  console.log('Success');
  res.status(200).json({});
})

router.post("/city", async (req, res) => {
  const body = req.body;
  const timezone = req.timezone;
  try {
    if (
      !body ||
      !body.cityId
    ) {
      throw new Error('Invalid params');
    }

    const avgRateOfACity = await propertiesService.getAvgNightlyRateForCity({
      cityId: body.cityId || '',
      timezone
    });

    return res
      .status(200)
      .json({ data: avgRateOfACity })
    ;
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      e: e && e.message ? e.message : e
    }).end();
  }
}),

router.get("/home", async (req, res) => {
  const timezone = req.timezone;
  // 1. Get Cities with avg nightly rates
  // 2. Get Popular Hotels
  // 3. Get Cheapest Hotels
  // 4. Get Offers

  const params = req.params || {};

  try {
    const offers = await offersService.getOffers();
    const cheapestProperties = await propertiesService.getCheapestProperties({timezone});
    const popularProperties = await propertiesService.getPopularProperties({timezone});
    const cities = await propertiesService.getAvgNightlyRateForCitiesOfACountry({
      timezone,
      countryId: params.countryId || config.countryId.UAE
    });

    return res
      .status(200)
      .json({
        offers, popularProperties, cheapestProperties, cities
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

router.post("/cities", async (req, res) => {
  const body = req.body;
  const timezone = req.timezone;
  try {
    const avgRatesOfCitiesOfACountry = await propertiesService.getAvgNightlyRateForCitiesOfACountry({
      timezone,
      countryId: body && body.countryId
        ? body.countryId
        : config.countryId.UAE
    });

    return res
      .status(200)
      .json({ data: avgRatesOfCitiesOfACountry })
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
  try {
    const offers = await offersService.getOffers();

    return res
      .status(200)
      .json({ data: offers })
    ;
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      e: e && e.message ? e.message : e
    }).end();
  }
});

router.get("/hotels-cheapest", async (req, res) => {
  const timezone = req.timezone;
  try {
    const cheapestPropertiesResult = await propertiesService.getCheapestProperties({timezone});
    return res
      .status(200)
      .json({ data: cheapestPropertiesResult })
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
  const timezone = req.timezone;
  try {
    const popularPropertiesResult = await propertiesService.getPopularProperties({timezone});
    return res
      .status(200)
      .json({ data: popularPropertiesResult })
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
