const Property = require("../db/models/properties");
const UserRating = require("../db/models/userratings");
const dateTimeService = require("./date-time");
const moment = require('moment');

const service = {

  getPropertyRating: async property => {
    let propertyUserRatings = await UserRating
      .find({
        approved: true,
        property: property._id,
        value: {$gt: 0}
      })
    ;

    const totalRatings = propertyUserRatings.reduce((a, b) => {
      return a + b.value
    }, 0);

    const averageRating = totalRatings
      ? totalRatings / propertyUserRatings.length
      : 0
    ;

    return {
      ...property,
      userRating: averageRating
    }
  },

  getPropertyRoomPrice: async params => {
    // if (params && params.propertyId) {
    //   const property = await Property.find({_id: params.propertyId}).lean();
    if (params && params.property) {
      return {
        ...params.property,
        price: parseInt(Math.random() * 300)
      }
    } else {
      throw new Error('Property ID not specified');
    }
  },

  // Usage
  // getPopularProperties({
  //   cityId: '5b6d1e1aff9fad1c1372f2d9', // and / or
  //   countryId: '5b6d1e1aff9fad1c1372f2d9'
  // })

  getPopularProperties: async (params) => {
    const popularPropertiesCount = 10;

    try {

      // 1. Get approved properties
      const properties = await Property
        .find({
          ...params,
          approved: true,
          published: true
        })
        .select('name location images featured currency contactinfo.country contactinfo.city rating rooms')
        .populate([
          {path: "currency"},
          {path: "rating"},
          {path: "rooms"},
          {path: "contactinfo.country"},
          {path: "contactinfo.city"}
        ])
        .lean()
      ;

      // 2. Populate ratings in properties
      const propertiesWithRatings = await Promise.all(
        properties.map(async property => {
          return await service.getPropertyRating(property)
        })
      );

      // 3. Sort Properties as per their ratings
      const propertiesWithSortedRatings = propertiesWithRatings
        .sort((a, b) => {
          if (a.rating < b.rating) { return -1}
          if (a.rating > b.rating) { return 1}
          return 0;
        })
        .reverse()
        .splice(0, popularPropertiesCount)
      ;

      // 4. Populate property rates
      const numberOfHours = 6;

      const checkinTimeMoment = dateTimeService.getNearestCheckinTimeMoment();
      const checkoutTimeMoment = moment(checkinTimeMoment).add(numberOfHours, "hours");

      const checkinTime = checkinTimeMoment.format("hh:mm"); // use next 30 minute slot from now
      const checkoutTime = checkoutTimeMoment.format("hh:mm"); // use {numberOfHours} hours from checkinTime
      const checkinDate = checkinTimeMoment.format('MM/DD/YYYY'); // use date of checkinTime (today, or next day if checkinTime is falling on the next day)
      const checkoutDate = checkoutTimeMoment.format('MM/DD/YYYY'); // use date of checkinDate (same, or next day if checkoutTime is falling on the next day)

      console.log('Popular Properties: checkinTime', checkinTime);
      console.log('Popular Properties: checkoutTime', checkoutTime);
      console.log('Popular Properties: checkinDate', checkinDate);
      console.log('Popular Properties: checkoutDate', checkoutDate);

      // const checkinTime = '16:30'; // use next 30 minute slot from now
      // const checkoutTime = '22:30'; // use {numberOfHours} hours from checkinTime
      // const checkinDate = '10/15/2020'; // use date of checkinTime (today, or next day if checkinTime is falling on the next day)
      // const checkoutDate = '10/15/2020'; // use date of checkinDate (same, or next day if checkoutTime is falling on the next day)

      const propertiesWithPrice = await Promise.all(await propertiesWithSortedRatings.map( async property => {
        return await service.getPropertyRoomPrice({
          propertyId: property._id,
          property, // debug
          checkinDate,
          checkoutDate,
          checkinTime,
          checkoutTime,
          type: 'hourly', // hourly or monthly
          cityId: '5b6d1e1aff9fad1c1372f2d9',
          countryId: '5b6d1e1aff9fad1c1372f2d9',
          numberAdults: 2,
          numberChildren: 0,
          numberRooms: 1
        })
      }));

      // console.log('popularProperties.length', popularProperties.length);
      // console.log('properties.length', properties.length);
      return propertiesWithPrice;
    } catch (e) {
      console.log('e', e);
      throw new Error(e.message)
    }
  },

  // Get Cheapest Properties
  getCheapestProperties: async (params) => {
    const cheapestPropertiesCount = 10;

    try {
      // 1. Get approved properties
      const properties = await Property
        .find({
          ...params,
          approved: true,
          published: true
        })
        .select('name location images featured currency contactinfo.country contactinfo.city rating rooms')
        .populate([
          {path: "currency"},
          {path: "rating"},
          {path: "rooms"},
          {path: "contactinfo.country"},
          {path: "contactinfo.city"}
        ])
        .lean()
      ;

      // 2. Populate property rates
      const numberOfHours = 6;

      const checkinTimeMoment = dateTimeService.getNearestCheckinTimeMoment();
      const checkoutTimeMoment = moment(checkinTimeMoment).add(numberOfHours, "hours");

      const checkinTime = checkinTimeMoment.format("hh:mm"); // use next 30 minute slot from now
      const checkoutTime = checkoutTimeMoment.format("hh:mm"); // use {numberOfHours} hours from checkinTime
      const checkinDate = checkinTimeMoment.format('MM/DD/YYYY'); // use date of checkinTime (today, or next day if checkinTime is falling on the next day)
      const checkoutDate = checkoutTimeMoment.format('MM/DD/YYYY'); // use date of checkinDate (same, or next day if checkoutTime is falling on the next day)

      console.log('Cheapest Properties: checkinTime', checkinTime);
      console.log('Cheapest Properties: checkoutTime', checkoutTime);
      console.log('Cheapest Properties: checkinDate', checkinDate);
      console.log('Cheapest Properties: checkoutDate', checkoutDate);

      // const checkinTime = '16:30'; // use next 30 minute slot from now
      // const checkoutTime = '22:30'; // use {numberOfHours} hours from checkinTime
      // const checkinDate = '10/15/2020'; // use date of checkinTime (today, or next day if checkinTime is falling on the next day)
      // const checkoutDate = '10/15/2020'; // use date of checkinDate (same, or next day if checkoutTime is falling on the next day)

      const propertiesWithPrice = await Promise.all(await properties.map( async property => {
        return await service.getPropertyRoomPrice({
          propertyId: property._id,
          property, // debug
          checkinDate,
          checkoutDate,
          checkinTime,
          checkoutTime,
          type: 'hourly', // hourly or monthly
          cityId: '5b6d1e1aff9fad1c1372f2d9',
          countryId: '5b6d1e1aff9fad1c1372f2d9',
          numberAdults: 2,
          numberChildren: 0,
          numberRooms: 1
        })
      }));

      // 3. Sort Properties as per their rates (ascending)
      const propertiesWithSortedPrice = propertiesWithPrice
        .sort((a, b) => {
          if (a.price < b.price) { return 1}
          if (a.price > b.price) { return -1}
          return 0;
        })
        .reverse()
        .splice(0, cheapestPropertiesCount)
      ;

      // 2. Populate ratings in properties
      const propertiesWithRatings = await Promise.all(
        propertiesWithSortedPrice.map(async property => {
          return await service.getPropertyRating(property)
        })
      );

      // console.log('properties.length', properties.length);
      return propertiesWithRatings;
    } catch (e) {
      console.log('e', e);
      throw new Error(e.message)
    }
  }
};

module.exports = service;
