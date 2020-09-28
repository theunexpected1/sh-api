const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const _ = require("underscore");
const moment = require("moment");
const mongoose = require("mongoose");
const generator = require("generate-password");
const multer = require("multer");
const pify = require("pify");
const path = require("path");
let url = require('url') ;
const sharp = require('sharp');
const request = require('request');
const fs = require('fs');
const passport = require("passport");
const jwt = require('jsonwebtoken');
const config = require("config");

const User = require("../../../db/models/users");
const Booking = require("../../../db/models/bookings");
const City = require("../../../db/models/cities");
const jwtMiddleware = require("../../../middleware/jwt");

// Services
const citiesServices = require("../../../services/cities")
const propertiesServices = require("../../../services/properties")

router.post("/authorized", jwtMiddleware.userAuthenticationRequired, (req, res) => {
  console.log('Success');
  res.status(200).json({});
})

router.get("/cities", async (req, res) => {
  try {
    const citiesWithAvgRate = await citiesServices.getCitiesWithAverageDailyRate();
    return res
      .status(200)
      .json({
        status: 1,
        data: citiesWithAvgRate
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
      }]
    })
  ;
});

router.get("/hotels-cheapest", async (req, res) => {
  try {
    const cheapestProperties = await propertiesServices.getCheapestProperties({});
    return res
      .status(200)
      .json({
        status: 1,
        data: cheapestProperties
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
    const popularProperties = await propertiesServices.getPopularProperties({});
    return res
      .status(200)
      .json({
        status: 1,
        data: popularProperties
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
