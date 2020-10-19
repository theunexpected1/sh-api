const db = require("../db/mongodb");
const Property = require("../db/models/properties");
const UserRating = require("../db/models/userratings");
const BookLog = require("../db/models/bookinglogs");
const Room = require("../db/models/rooms");
const Currency = require("../db/models/currencies");
const City = require("../db/models/cities");
const PropertyType = require("../db/models/propertytypes");
const PropertyRating = require("../db/models/propertyratings");
const RoomType = require("../db/models/roomtypes");
const BedType = require("../db/models/bedtypes");
const Service = require("../db/models/services");

const dateTimeService = require("./date-time");
const checkinService = require("./checkin");
const moment = require('moment-timezone');
const { property } = require("underscore");
const config = require("config");

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

  /**
   * Params:
      checkinDate,
      checkoutDate,
      checkinTime,
      checkoutTime,
      numberRooms: 1
   */
  getUnavailableRoomsIds: async params => {
    const checkinDate = params.checkinDate;
    const checkinTime = params.checkinTime;
    const checkoutDate = params.checkoutDate;
    const checkoutTime = params.checkoutTime;
    const numberRooms = params.numberRooms;

    try {
      const query = [
        {
          $match: {
            slotStartTime: {
              $gte: moment(`${checkinDate} ${checkinTime}`, 'MM/DD/YYYY HH:mm').toDate(),
              $lt: moment(`${checkoutDate} ${checkoutTime}`, 'MM/DD/YYYY HH:mm').toDate()
            },
          }
        },
        {
          $group: {
            _id: {
              property: '$property',
              room: '$room',
            },
            property: { $first: '$property'},
            room: { $first: '$room'},
            blockedRoomNumbers: {
              $addToSet: '$number'
            }
          }
        },
        {
          $project: {
            property: 1,
            room: 1,
            blockedRoomNumbers: 1,
            numberOfRoomsBlocked: {$size: '$blockedRoomNumbers'}
          }
        },
        {
          $lookup: {
            from: "rooms",
            localField: "room",
            foreignField: "_id",
            as: "roomDetails"
          }
        },
        {
          $lookup: {
            from: "properties",
            localField: "property",
            foreignField: "_id",
            as: "propertyDetails"
          }
        },
        {
          $unwind: '$roomDetails'
        },
        {
          $unwind: '$propertyDetails'
        },
        {
          $project: {
            blockedRoomNumbers: 1,
            roomId: '$room',
            room: '$roomDetails',
            propertyId: '$property',
            property: '$propertyDetails',
            numberOfRoomsInventory: '$roomDetails.number_rooms',
            numberOfRoomsBlocked: 1,
            numberOfRoomsAvailable: {
              $subtract: [
                '$roomDetails.number_rooms',
                '$numberOfRoomsBlocked'
              ]
            }
          }
        },
        {
          $match: {
            numberOfRoomsAvailable: {
              $lt: numberRooms
            }
          }
        }
      ];

      const unavailableRoomsInfo = await BookLog.aggregate(query);
      // console.log('Rooms requested: ', numberRooms);
      // console.log('Rooms Available (per room Id): ', unavailableRoomsInfo.map(unavailableRoomInfo => unavailableRoomInfo.numberOfRoomsAvailable));
      // console.log('UnAvailable Rooms Ids: ', unavailableRoomsInfo.map(unavailableRoomInfo => unavailableRoomInfo.roomId.toString()));
      return unavailableRoomsInfo.map(unavailableRoomInfo => unavailableRoomInfo.roomId.toString());
    } catch (e) {
      console.log('e', e);
    }
  },

  /**
   * Get avg nightly rate for a city
   * specific city, hourly booking, 2 adults, 0 children, 1 room, 1 standard day (14:00 to next day 12:00)
   */
  getAvgNightlyRateForCity: async params => {
    params = params || {};

    try {
      const timezone = params.timezone;
      const checkinTimeMoment = moment().tz(timezone).set({hour: 14, minute: 0, second: 0, millisecond: 0});
      const checkoutTimeMoment = moment(checkinTimeMoment).add(1, "day").set({hour: 12, minute: 0, second: 0, millisecond: 0});

      const checkinTime = checkinTimeMoment.format("HH:mm");
      const checkoutTime = checkoutTimeMoment.format("HH:mm");
      const checkinDate = checkinTimeMoment.format('MM/DD/YYYY');
      const checkoutDate = checkoutTimeMoment.format('MM/DD/YYYY');

      // console.log('Cities Avg Nightly rate:');
      // console.log('checkinDate', checkinDate, 'checkinTime', checkinTime);
      // console.log('checkoutTime', checkoutTime, 'checkoutDate', checkoutDate);
      
      const currencyAED = await Currency.findOne({code: 'AED'});
      // console.log('currencyAED', currencyAED);

      let propertiesResult = await service.getProperties({
        checkinDate,
        checkoutDate,
        checkinTime,
        checkoutTime,
        bookingType: 'hourly', // hourly or monthly
        cityId: params.cityId || '',
        numberAdults: parseInt(params.numberAdults) || 2,
        numberChildren: parseInt(params.numberChildren) || 0,
        numberRooms: parseInt(params.numberRooms) || 1,
        timezone
      }, {
        sort: 'price',
        orderBy: 'asc',
        limit: 200000
      });

      const totalPrices = propertiesResult.list.reduce((a, property) => {
        console.log('Prices for city property.priceSummary.base.amount', property.priceSummary.base.amount);
        return a + property.priceSummary.base.amount;
      }, 0)
      return {
        averagePrice: parseInt(totalPrices / propertiesResult.list.length),
        currency: currencyAED
      }
    } catch (e) {
      console.log('e', e);
      throw new Error(e.message)
    }
  },

  /**
   * Get avg nightly rate for a city
   * specific city, hourly booking, 2 adults, 0 children, 1 room, 1 standard day (14:00 to next day 12:00)
   */
  getAvgNightlyRateForCitiesOfACountry: async params => {
    params = params || {};

    try {
      const timezone = params.timezone;
      const checkinTimeMoment = moment().tz(timezone).set({hour: 14, minute: 0, second: 0, millisecond: 0});
      const checkoutTimeMoment = moment(checkinTimeMoment).add(1, "day").set({hour: 12, minute: 0, second: 0, millisecond: 0});

      const checkinTime = checkinTimeMoment.format("HH:mm");
      const checkoutTime = checkoutTimeMoment.format("HH:mm");
      const checkinDate = checkinTimeMoment.format('MM/DD/YYYY');
      const checkoutDate = checkoutTimeMoment.format('MM/DD/YYYY');
      const numberAdults = parseInt(params.numberAdults) || 2;
      const numberChildren = parseInt(params.numberChildren) || 0;
      const numberRooms = parseInt(params.numberRooms) || 1;
      const countryId = params.countryId || '';
      const bookingType = 'hourly'; // hourly or monthly

      // console.log(`Cities of Country ${params.countryId} Avg Nightly rate:`);
      // console.log('checkinDate', checkinDate, 'checkinTime', checkinTime);
      // console.log('checkoutTime', checkoutTime, 'checkoutDate', checkoutDate);

      const cities = await City.find({ country: db.Types.ObjectId(params.countryId) }).lean();
      const currencyAED = await Currency.findOne({code: 'AED'}).lean();
      // console.log('cities', cities);
      // console.log('currencyAED', currencyAED);

      if (cities && cities.length) {
        let propertiesResult = await service.getProperties({
          checkinDate,
          checkoutDate,
          checkinTime,
          checkoutTime,
          bookingType,
          countryId,
          numberAdults,
          numberChildren,
          numberRooms,
          timezone
        }, {
          sort: 'price',
          orderBy: 'asc',
          limit: 200000
        });

        // Create object with cityIds as keys
        const cityPrices = {};
        cities.map(city => {
          cityPrices[city._id.toString()] = cityPrices[city._id.toString()] || {
            count: 0,
            totalPrice: 0,
            averagePrice: 0,
            ...city,
            currency: currencyAED
          };
        });

        // Get totals and counts
        propertiesResult.list.map(property => {
          if (
            property.contactinfo.city &&
            (typeof cityPrices[property.contactinfo.city._id.toString()] === 'object')
          ) {
            cityPrices[property.contactinfo.city._id.toString()].count++;
            cityPrices[property.contactinfo.city._id.toString()].totalPrice += property.priceSummary.base.amount;
          }
        });

        // Get averages
        Object.keys(cityPrices).map(cityId => {
          if (cityPrices[cityId] && cityPrices[cityId].totalPrice && cityPrices[cityId].count) {
            cityPrices[cityId].averagePrice = parseInt(cityPrices[cityId].totalPrice / cityPrices[cityId].count);
          }
        })

        // Transform - Convert Object to Array
        let cityPricesArr = [];
        Object.keys(cityPrices).map(cityId => {
          // Transform the information
          const cityPriceDetails = JSON.parse(JSON.stringify(cityPrices[cityId]));
          delete cityPriceDetails.count;
          delete cityPriceDetails.totalPrice;
          delete cityPriceDetails.country;
          cityPricesArr.push(cityPriceDetails);
        });

        // Remove cities that have 0 average rate
        cityPricesArr = cityPricesArr.filter(city => !!city.averagePrice);

        // Provide the original query back to the frontend // Or provide the generated property detail URL
        const originalQuery = {checkinDate, checkoutDate, checkinTime, checkoutTime, numberAdults, numberChildren, numberRooms, bookingType};
        return {
          list: cityPricesArr,
          query: originalQuery
        };
      } else {
        return {};
      }
    } catch (e) {
      console.log('e', e);
      throw new Error(e.message)
    }
  },

  /**
   * Get properties with ratings and pricing, based on all parameters: query, filters, sorting
   * 1. get hours distribution for all dates of this stay (date & standard/full info)
   * 2. get unavailable Rooms
   * 3. Prepare properties aggregate query and run the aggregation (skip unavailable rooms)
   * 4. Populate Properties' Rooms' Pricing
   * 5. Populate Properties' User Ratings
   * 6. Sort and paginate list
   * 7. Provide the original query back to the frontend // Or provide the generated property detail URL
   */
  getProperties: async (params, options) => {
    params = params || {}
    options = options || {}
    const location = params.location;
    let checkinDate = params.checkinDate;
    let checkoutDate = params.checkoutDate;
    let checkinTime = params.checkinTime;
    let checkoutTime = params.checkoutTime;
    const cityId = params.cityId;
    const countryId = params.countryId;
    const numberAdults = parseInt(params.numberAdults) || 2;
    const numberChildren = parseInt(params.numberChildren) || 0;
    const numberRooms = parseInt(params.numberRooms) || 1;
    const properties = params.properties || [];
    const rooms = params.rooms || [];
    const shouldGetPropertiesWithRates = true;
    const isTestingRates = !!(params && params.isTestingRates);
    const timezone = params.timezone;

    // Filters
    const priceMin = params.priceMin !== null ? params.priceMin : params.priceMin;
    const priceMax = params.priceMax !== null ? params.priceMax : params.priceMax;
    const propertyTypes = params.propertyTypes ? params.propertyTypes.split(',') : [];
    const propertyRatings = params.propertyRatings ? params.propertyRatings.split(',') : [];
    const roomTypes = params.roomTypes ? params.roomTypes.split(',') : [];
    const bedTypes = params.bedTypes ? params.bedTypes.split(',') : [];
    const amenities = params.amenities ? params.amenities.split(',') : [];

    const checkinDateMoment = moment(`${checkinDate} ${checkinTime}`, 'MM/DD/YYYY HH:mm');
    const checkoutDateMoment = moment(`${checkoutDate} ${checkoutTime}`, 'MM/DD/YYYY HH:mm');

    let bookingType;
    switch (params.bookingType) {
      case 'monthly':
      case 'long-term':
        bookingType = 'long-term';
        // ensure monthly is more than 30 days and less than 12 months
        // TODO: use checkinDateMoment, checkoutDateMoment
        break;
      case 'hourly':
      case 'short-term':
      default:
        // ensure hourly is more than 3 hours and less than 12 months
        // TODO: use checkinDateMoment, checkoutDateMoment
        bookingType = 'short-term';
        break;
    }

    // 1. get hours distribution for all dates of this stay
    const datesAndHoursParams = await checkinService.getDatesAndHoursStayParams({checkinDate, checkoutDate, checkinTime, checkoutTime});
    console.log('Dates & Hours params:', datesAndHoursParams);

    console.log('Applied Filters:', priceMin, priceMax, propertyTypes, propertyRatings, roomTypes, bedTypes, amenities);

    // 2. Get unavailable Room IDs
    const unavailableRooms = await service.getUnavailableRoomsIds({checkinDate, checkoutDate, checkinTime, checkoutTime, numberRooms})
    // console.log('unavailableRooms', unavailableRooms);

    // 3. Prepare properties aggregate query and run the aggregation
    // - Filters Phase 1: Send in filters in aggregate query
    const aggregateQuery = service.getAggregateQuery({
      shouldGetPropertiesWithRates,
      datesAndHoursParams,
      unavailableRooms,

      cityId,
      countryId,
      location,
      numberAdults,
      numberChildren,
      numberRooms,
      isTestingRates,
      bookingType,
      properties,
      rooms,

      propertyTypes,
      propertyRatings,
      roomTypes,
      bedTypes,
      amenities
    });

    console.log('- ', moment().tz(timezone).format('DD MMM YYYY hh:mm a'));
    let list = await Room.aggregate(aggregateQuery);
    // console.log('aggregateQuery', JSON.stringify(aggregateQuery));

    // 4. Populate Properties' Rooms' Pricing
    // - Filters Phase 2: Also, send pricing filters (Can filter price only after aggregation as pricing is a separate process)
    list = await service.populatePropertiesPricing(list, {
      bookingType,
      datesAndHoursParams,
      priceMin,
      priceMax
    });

    // 5. Populate Properties' User Ratings
    list = await Promise.all(list.map(service.getPropertyRating));

    // 6. Sort and paginate list (Defaults will be handled by sortAndPaginateProperties method, so don't decide default here)
    const limit = params && params.limit
      ? params.limit
      : options && options.limit
    ;
    // veto: Specify distance as a default if there is location provided, otherwise let the method do it's job
    const sort = params && params.sort
      ? (params.sort === 'distance' && !location ? '' : params.sort)
      : options && options.sort
        ? (options.sort === 'distance' && !location ? '' : options.sort)
        : !location ? '' : 'distance'
    ;
    const orderBy = params && params.orderBy
      ? params.orderBy
      : options && options.orderBy
    ;
    const page = params && params.page
      ? params.page
      : options && options.page
        ? options && options.page
        : 1
    ;

    const sortedPaginatedResult = await service.sortAndPaginateProperties(list, page, sort, orderBy, limit);
    const { count, totalPages } = sortedPaginatedResult;
    list = sortedPaginatedResult.list;

    // 7. Provide the original query back to the frontend // Or provide the generated property detail URL

    let bookingTypeForQuery;
    switch (bookingType) {
      case 'monthly':
      case 'long-term':
        bookingTypeForQuery = 'monthly';
        break;
      case 'hourly':
      case 'short-term':
      default:
        bookingTypeForQuery = 'hourly';
        break;
    }

    const originalQuery = {checkinDate, checkoutDate, checkinTime, checkoutTime, numberAdults, numberChildren, numberRooms, bookingType: bookingTypeForQuery};
    return {
      list,
      count,
      page,
      totalPages,
      query: originalQuery
    };
  },

  sortAndPaginateProperties: async (list, page, sort, orderBy, limit) => {

    // Sorting
    const count = list.length;
    const pageSize = parseInt(config.pageSize.searchProperties);
    page = page || 1;
    limit = limit || pageSize;
    sort = sort || 'price';
    orderBy = orderBy || 'asc';

    const skip = (page-1) * limit;
    const totalPages = Math.ceil(count / limit);

    switch (sort) {
      case 'userRating':
        // Sort Properties as per their ratings
        list = list.sort((a, b) => orderBy === 'asc'
          ? a.userRating - b.userRating
          : b.userRating - a.userRating
        );
        break;
      case 'distance':
        // Sort Properties as per their distance
        list = list.sort((a, b) => orderBy === 'asc'
          ? a.distance - b.distance
          : b.distance - a.distance
        );
        break;
      case 'price':
      default:
        // Sort Properties as per their price
        list = list.sort((a, b) => orderBy === 'asc'
          ? a.priceSummary.base.amount - b.priceSummary.base.amount
          : b.priceSummary.base.amount - a.priceSummary.base.amount
        );
      break;
    }

    // Pagination
    // for Method 2:
    list = list.splice(skip, limit);

    return { list, count, totalPages };
  },

  getPopularProperties: async params => {
    params = params || {};

    try {
      const popularPropertiesPageSize = config.pageSize.popularPropertiesPageSize;
      const numberOfHours = 6;
      const timezone = params.timezone;
      const checkinTimeMoment = dateTimeService.getNearestCheckinTimeMoment(timezone);
      const checkoutTimeMoment = moment(checkinTimeMoment).add(numberOfHours, "hours");

      const checkinTime = checkinTimeMoment.format("HH:mm"); // use next 30 minute slot from now
      const checkoutTime = checkoutTimeMoment.format("HH:mm"); // use {numberOfHours} hours from checkinTime
      const checkinDate = checkinTimeMoment.format('MM/DD/YYYY'); // use date of checkinTime (today, or next day if checkinTime is falling on the next day)
      const checkoutDate = checkoutTimeMoment.format('MM/DD/YYYY'); // use date of checkinDate (same, or next day if checkoutTime is falling on the next day)

      console.log('=========Popular Properties=========');
      console.log('checkinTime', checkinTime);
      console.log('checkoutTime', checkoutTime);
      console.log('checkinDate', checkinDate);
      console.log('checkoutDate', checkoutDate);

      // const checkinTime = '16:30'; // use next 30 minute slot from now
      // const checkoutTime = '22:30'; // use {numberOfHours} hours from checkinTime
      // const checkinDate = '10/15/2020'; // use date of checkinTime (today, or next day if checkinTime is falling on the next day)
      // const checkoutDate = '10/15/2020'; // use date of checkinDate (same, or next day if checkoutTime is falling on the next day)

      let propertiesResult = await service.getProperties({
        checkinDate,
        checkoutDate,
        checkinTime,
        checkoutTime,
        bookingType: 'hourly', // hourly or monthly
        cityId: params.cityId || '',
        countryId: params.countryId || '',
        numberAdults: params.numberAdults || 2,
        numberChildren: params.numberChildren || 0,
        numberRooms: params.numberRooms || 1,
        timezone
      }, {
        sort: 'userRating',
        orderBy: 'desc',
        limit: popularPropertiesPageSize
      })

      // Append stay duration information
      propertiesResult.list.map(p => {
        p.stayDuration = {
          label: `${numberOfHours} Hours`
        };
        return p;
      });

      return propertiesResult;
    } catch (e) {
      console.log('e', e);
      throw new Error(e.message)
    }
  },

  // Get Cheapest Properties
  getCheapestProperties: async params => {
    params = params || {};

    try {
      const cheapestPropertiesPageSize = config.pageSize.cheapestPropertiesPageSize;
      const numberOfHours = 3;
      const timezone = params.timezone;
      const checkinTimeMoment = dateTimeService.getNearestCheckinTimeMoment(timezone);
      const checkoutTimeMoment = moment(checkinTimeMoment).add(numberOfHours, "hours");

      const checkinTime = checkinTimeMoment.format("HH:mm"); // use next 30 minute slot from now
      const checkoutTime = checkoutTimeMoment.format("HH:mm"); // use {numberOfHours} hours from checkinTime
      const checkinDate = checkinTimeMoment.format('MM/DD/YYYY'); // use date of checkinTime (today, or next day if checkinTime is falling on the next day)
      const checkoutDate = checkoutTimeMoment.format('MM/DD/YYYY'); // use date of checkinDate (same, or next day if checkoutTime is falling on the next day)

      console.log('=========Cheapest Properties=========');
      console.log('checkinTime', checkinTime);
      console.log('checkoutTime', checkoutTime);
      console.log('checkinDate', checkinDate);
      console.log('checkoutDate', checkoutDate);

      // const checkinTime = '16:30'; // use next 30 minute slot from now
      // const checkoutTime = '22:30'; // use {numberOfHours} hours from checkinTime
      // const checkinDate = '10/15/2020'; // use date of checkinTime (today, or next day if checkinTime is falling on the next day)
      // const checkoutDate = '10/15/2020'; // use date of checkinDate (same, or next day if checkoutTime is falling on the next day)

      let propertiesResult = await service.getProperties({
        checkinDate,
        checkoutDate,
        checkinTime,
        checkoutTime,
        bookingType: 'hourly', // hourly or monthly
        cityId: params.cityId || '',
        countryId: params.countryId || '',
        numberAdults: parseInt(params.numberAdults) || 2,
        numberChildren: parseInt(params.numberChildren) || 0,
        numberRooms: parseInt(params.numberRooms) || 1,
        timezone
      }, {
        sort: 'price',
        orderBy: 'asc',
        limit: cheapestPropertiesPageSize
      });

      // Append stay duration information
      propertiesResult.list.map(p => {
        p.stayDuration = {
          label: `${numberOfHours} Hours`
        };
        return p;
      });

      return propertiesResult;
    } catch (e) {
      console.log('e', e);
      throw new Error(e.message)
    }
  },

  getRoomPriceForDates: async (room, bookingType, datesAndHoursParams) => {
    const property = room.property;

    // Ensure it's more than 1, otherwise no use of recurring
    const maxRecurringYears = 10;

    if (!room || !room.rates || !room.rates.length) {
      room.priceSummary = {};
      console.log('returning early', room);
      return room;
    }

    const defaultRoomPriceForBookingType = room.rates.find(rr => rr.isDefault && rr.rateType === bookingType);
    // Sort so that we get the earlier defined rates before others
    // Between below 2 custom rates {1} and {2}, {1} will be favored as it's preceeding {2}. {2} will be ignored
    // {1}. 4th Oct to 6th October
    // {2}. 5th October
    const otherRoomRatesForBookingType = room.rates
      .filter(rr => !rr.isDefault && rr.rateType === bookingType)
      .sort((a, b) => {
        const aDateFrom = new Date(a.dateFrom).getTime();
        const bDateFrom = new Date(b.dateFrom).getTime();
        if (aDateFrom < bDateFrom) { return -1}
        if (aDateFrom > bDateFrom) { return 1}
        return 0;
      })
    ;

    const getRateForTheDateParams = (dateParams, weekends) => {
      weekends = weekends || [];
      let customRate = null;
      let roomRateInfo; // weekday: {fullDay: 0, standardDay: 0, hours: []} or weekend: {fullDay: 0, standardDay: 0, hours: []}
      const {date, rateType, hours, hoursKeys} = dateParams;
      const targetDateMoment = moment(date, 'MM/DD/YYYY');
      const dateWeekdayName = targetDateMoment.format('ddd').toLowerCase();
      const weekendOrWeekday = weekends.indexOf(dateWeekdayName) > -1 ? 'weekend' : 'weekday';

      // Look across all rate customizations
      otherRoomRatesForBookingType.map(roomRate => {
        // Run until we find first custom rate in range
        if (!customRate) {
          const isRecurring = roomRate.recurring;
          const customRateDateFromMoment = moment(roomRate.dateFrom, 'MM/DD/YYYY');
          const customRateDateToMoment = moment(roomRate.dateTo, 'MM/DD/YYYY');
          // Recurring date ? Check if date is present in the date range, across {maxRecurringYears || 10} years
          if (isRecurring) {
            // Look across 0th year (first of definition) untill {maxRecurringYears || 10} occurances
            // range of 10/04/2020 to 12/04/2020 recurring means look from 2020 to 2030 (both inclusive, so 11 years)
            for (let i=0; i<=maxRecurringYears; i++) {
              // Run until we find first rate as we could be in that year currently, hence no point looking beyond
              if (!customRate) {
                const currentYearDateFromMoment = moment(customRateDateFromMoment).add(i, 'years');
                const currentYearDateToMoment = moment(customRateDateToMoment).add(i, 'years');
                const isInRange = targetDateMoment.isSameOrAfter(currentYearDateFromMoment) && targetDateMoment.isSameOrBefore(currentYearDateToMoment);
                if (isInRange) {
                  // Found in recurring, so we can exit with this rate
                  console.log('Recurring: Found in recurring, so we can exit with default rate');
                  customRate = roomRate;
                }
              }
            }
          } else {
            // Non-recurring date ? Check if date is present in the date range
            const isInRange = targetDateMoment.isSameOrAfter(customRateDateFromMoment) && targetDateMoment.isSameOrBefore(customRateDateToMoment);
            if (isInRange) {
              console.log('Non-Recurring: Found in one time range, so we can exit with customRate');
              customRate = roomRate;
            }
          }
        }
      })

      let minBookingRateForFullDay = null;

      // use rates from customized rates
      if (customRate) {
        // console.log(`- [Custom rate "${customRate.name}"]: Rate used for "${property.name}"`);
        roomRateInfo = customRate[weekendOrWeekday]; // weekday: {} or weekend: {}

        // Get minimum booking rate for fullDay from Custom Rate
        if (customRate.minimumBookingRate && rateType === 'fullDay') {
          minBookingRateForFullDay = customRate.minimumBookingRate;
        }
      } else {
        // use rates from default rates
        // console.log(`- [DefaultRate]: Rate used for "${property.name}"`);
        roomRateInfo = defaultRoomPriceForBookingType[weekendOrWeekday]; // weekday: {} or weekend: {}

        // Get minimum booking rate for fullDay from Custom Rate
        if (defaultRoomPriceForBookingType.minimumBookingRate && rateType === 'fullDay') {
          minBookingRateForFullDay = defaultRoomPriceForBookingType.minimumBookingRate;
        }
      }

      // {weekday/weekend}.standardRate if 'rateType' is 'standardDay'
      if (rateType === 'standardDay') {
        return { rate: roomRateInfo[rateType] };
      } else if (rateType === 'fullDay') {
        // get rate of each hour as specified in the Room Rate if 'rateType' is 'fullDay'
        // We have 30 minute intervals, so we need to split the Hourly rate into 2 for each key
        // @example
        // For a checking from 10am to 11:30am, we need rates for 10:00, 10:30 and 11:00
        // which results in keys ['h10', 'h10', 'h11'] for each half hour
        // thereby resulting in rates: [rateFor10AM / 2, rateFor10AM / 2, rateFor11AM / 2]
        // hoursKeys sample ['h10', 'h10', 'h11']
        // roomRateInfo.hours sample {h10: 12, h11: 15}
        // Result of below = 12 + (15/2) = 19.5
        // if (room._id.toString() === '5cbc49edc22cb26e2baaab9e') {
        //   console.log('hoursKeys for 5cbc49edc22cb26e2baaab9e', hoursKeys);
        //   console.log('roomRateInfo for 5cbc49edc22cb26e2baaab9e', roomRateInfo);
        // }
        const rate =  hoursKeys.reduce((a, b) => {
          return a + roomRateInfo.hours[b] / 2
        }, 0);

        return { minimumBookingRate: minBookingRateForFullDay, rate };
      } else {
        console.log('something fundamentally wrong here, no other types of rates are supported');
        return { rate: 0 };
      }
    }

    const minimumBookingRates = [];

    // Base Fee
    const base = {
      label: 'Base Price',
      amount: parseInt(datesAndHoursParams.reduce((accumulator, dateParams) => {
        const {minimumBookingRate, rate} = getRateForTheDateParams(dateParams, property.weekends);
        // Keep track of minimum booking rates to apply if the total rate turns out to be lower
        if (minimumBookingRate) {
          minimumBookingRates.push(minimumBookingRate);
        }
        return accumulator + rate;
      }, 0))
    };

    // Ensure we choose the higher amount
    if (minimumBookingRates && minimumBookingRates.length) {
      base.amount = Math.max(base.amount, ...minimumBookingRates);
    }

    // Add savings data, if it exists
    // Assume all custom rates (fullDay Rates) to be standardDay Rates
    // what would cost a customer 20 dhs for few hours, would cost them 150 dhs for full day otherwise
    // That excess is savings for them
    if (datesAndHoursParams.find(dh => dh.rateType === 'fullDay')) {
      const normalBookingDatesAndHoursParams = JSON.parse(JSON.stringify(datesAndHoursParams)).map(dh => {
        dh.rateType = 'standardDay';
        dh.hours = [];
        return dh;
      });

      const normalRate = parseInt(normalBookingDatesAndHoursParams.reduce((accumulator, dateParams) => {
        const {rate} = getRateForTheDateParams(dateParams, property.weekends);
        return accumulator + rate;
      }, 0));
      if ((normalRate > 0) && (normalRate > base.amount)) {
        base.savings = normalRate - base.amount;
      }
    }

    // Booking Fee
    const bookingFee = {
      label: 'Booking fee',
      currency: '',
      amount: 0
    };

    if (
      property.contactinfo &&
      property.contactinfo.country &&
      property.contactinfo.country._id &&
      config.bookingFee &&
      config.bookingFee[property.contactinfo.country._id]
    ) {
      const bookingFeeForCountry = config.bookingFee[property.contactinfo.country._id].find(bf => bf.bookingType === bookingType);
      bookingFee.amount = bookingFeeForCountry.fee;
      bookingFee.currency = await Currency.findOne({_id: bookingFeeForCountry.currency});
    }

    // Taxes
    const taxes = {
      label: 'Taxes',
      // currency: property.currency,
      breakdown: [],
      amount: 0
    }

    property.charges.map(tax => {
      const taxAmount = service.getCalculatedTax(tax, base.amount);
      taxes.breakdown.push({
        label: tax.name,
        amount: taxAmount
      })
      taxes.amount += taxAmount;
    })

    // Get the rates for date / hours combination

    // console.log(`[${property.currency.code} ${base.amount}]: Price for Room of "${property.name}"`);Rate used for

    // delete room.rates;
    room.priceSummary = {
      base,
      taxes,
      bookingFee,
      total: {
        label: "Total Amount",
        amount: base.amount + bookingFee.amount
      },
      payNow: {
        label: "Now you pay",
        currency: bookingFee.currency,
        amount: bookingFee.amount
      },
      payAtHotel: {
        label: "Pay at the hotel",
        amount: base.amount
      }
    }
    return room;
  },

  getAggregateQuery: (params) => {
    const {
      shouldGetPropertiesWithRates,
      datesAndHoursParams,
      unavailableRooms,

      cityId,
      countryId,
      location,
      numberAdults,
      numberChildren,
      numberRooms,
      isTestingRates,
      bookingType,
      properties,
      rooms,

      propertyTypes,
      propertyRatings,
      roomTypes,
      bedTypes,
      amenities
    } = params;

    // 3. properties Query
    const propertiesQuery = {'$and': []};

    // Conditions to apply only if the rates are not just being testing
    // @example
    // If a hotel / SH Admin is testing rates, they would want to see rates even if the property is unapproved / unpublished / agreement is not signed / etc.
    if (!isTestingRates) {

      // Property status
      propertiesQuery['$and'].push({'property.approved': true});
      propertiesQuery['$and'].push({'property.published': true});

      // Property agreement needs to be signed in
      propertiesQuery['$and'].push({'property.agreement': {$exists: true}});
      propertiesQuery['$and'].push({'property.agreement.isAgreementSigned': true});
    }

    // Property needs to have currency
    propertiesQuery['$and'].push({'property.currency': {$exists: true}});

    // Filter out properties that don't have anyTimeCheckin enabled if the user wants to stay during non-standard hours
    if (!!datesAndHoursParams.find(dh => dh.rateType === 'fullDay')) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      propertiesQuery['$and'].push({
        'property.anyTimeCheckin': true
      })
    }

    // filter specific Country
    if (countryId) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      propertiesQuery['$and'].push({
        'property.contactinfo.country._id': db.Types.ObjectId(countryId)
      })
    }

    // filter specific City
    if (cityId) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      propertiesQuery['$and'].push({
        'property.contactinfo.city._id': db.Types.ObjectId(cityId)
      })
    }

    // Look for specific properties only (Even if unavailable from previous query)
    if (properties && properties.length && isTestingRates) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      propertiesQuery['$and'].push({
        'property._id': {
          $in: properties.map(p => db.Types.ObjectId(p))
        }
      })
    }

    // Filter by Property Types
    if (propertyTypes && propertyTypes.length) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      const propertyTypesIds = propertyTypes.filter(ptId => !!ptId).map(ptId => db.Types.ObjectId(ptId));
      if (propertyTypesIds && propertyTypesIds.length) {
        propertiesQuery['$and'].push({ 'property.type._id': { $in: propertyTypesIds } })
      }
    }

    // Filter by Property Ratings
    if (propertyRatings && propertyRatings.length) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      const propertyStarRatingsIds = propertyRatings.filter(rId => !!rId).map(rId => db.Types.ObjectId(rId));
      if (propertyStarRatingsIds && propertyStarRatingsIds.length) {
        propertiesQuery['$and'].push({ 'property.rating._id': { $in: propertyStarRatingsIds } })
      }
    }

    // 4. roomsQuery
    const roomsQuery = {'$and': []};

    // filter only those that have rates defined
    if (shouldGetPropertiesWithRates) {
      roomsQuery['$and'] = roomsQuery['$and'] || [];

      const ratesExistConditions = {
        "rates.0": {$exists: true}
      };

      const ratesTypeDefined = {
        $or: [
          {
            "rates.0.rateType": bookingType
          },
          {
            "rates.1.rateType": bookingType
          },
        ]
      };

      roomsQuery['$and'].push(ratesExistConditions);
      roomsQuery['$and'].push(ratesTypeDefined);
    }

    // filter guests (adult / children)
    if (numberAdults) {
      roomsQuery['$and'] = roomsQuery['$and'] || [];
      roomsQuery['$and'].push({
        'number_of_guests.value': {$gte: numberAdults}
      })
    }

    if (numberChildren) {
      roomsQuery['$and'] = roomsQuery['$and'] || [];
      roomsQuery['$and'].push({
        'number_of_guests.childrenValue': {$gte: numberChildren}
      })
    }

    // filter number of rooms
    if (numberRooms) {
      roomsQuery['$and'] = roomsQuery['$and'] || [];
      roomsQuery['$and'].push({
        'number_rooms': {$gte: numberRooms  }
      })
    }

    // Filter by Room Types
    if (roomTypes && roomTypes.length) {
      roomsQuery['$and'] = roomsQuery['$and'] || [];
      const roomTypesIds = roomTypes.filter(id => !!id).map(id => db.Types.ObjectId(id));
      if (roomTypesIds && roomTypesIds.length) {
        roomsQuery['$and'].push({ 'room_type._id': { $in: roomTypesIds } })
      }
    }

    // Filter by Bed Types
    if (bedTypes && bedTypes.length) {
      roomsQuery['$and'] = roomsQuery['$and'] || [];
      const bedTypesIds = bedTypes.filter(id => !!id).map(id => db.Types.ObjectId(id));
      if (bedTypesIds && bedTypesIds.length) {
        roomsQuery['$and'].push({ 'bed_type._id': { $in: bedTypesIds } })
      }
    }

    // Filter by Amenities
    if (amenities && amenities.length) {
      roomsQuery['$and'] = roomsQuery['$and'] || [];
      const amenitiesIds = amenities.filter(id => !!id).map(id => db.Types.ObjectId(id));
      if (amenitiesIds && amenitiesIds.length) {
        roomsQuery['$and'].push({ 'services._id': { $in: amenitiesIds } })
      }
    }


    // Look for specific rooms only (Even if unavailable from previous query)
    if (rooms && rooms.length && isTestingRates) {
      const forceRoomIds = rooms.filter(id => !!id).map(id => db.Types.ObjectId(id));
      roomsQuery['$and'] = roomsQuery['$and'] || [];
      roomsQuery['$and'].push({
        _id: {
          $in: forceRoomIds
        }
      })
    } else {

      // Ignore unavailable rooms
      if (unavailableRooms && unavailableRooms.length) {
        const unavailableRoomIds = unavailableRooms.filter(id => !!id).map(id => db.Types.ObjectId(id));
        roomsQuery['$and'] = roomsQuery['$and'] || [];
        roomsQuery['$and'].push({
          _id: {
            $nin: unavailableRoomIds
          }
        })
      }
    }

    let propertyPipeline = [
      {
        $match: {
          $expr: {
            $eq: ["$_id", "$$roomPropertyId"]
          }
        }
      }
    ];

    // Get properties near to the specified location (40 kms)
    if (location) {
      const latLng = location.split(',');
      lat = latLng[0].trim();
      lng = latLng[1].trim();
      propertyPipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [parseFloat(lng),parseFloat(lat)]
            },
            key: "property.location",
            spherical: true,
            distanceMultiplier: 0.001,
            distanceField: "distance"
          }
        },
        {
          $match: {
            $expr: { 
              $and: [
                { $eq: ["$_id", "$$roomPropertyId"] },
                { $lte: ["$distance", 40] }
              ]
            }
          }
        }
      ];
    }

    // 5. Populations & projections
    const propertyPopulations = [
      // property
      {
        $lookup: {
          from: "properties",
          let: {
            roomPropertyId: "$property_id"
          },
          pipeline: propertyPipeline,
          as: "property"
        }
      },
      {
        $unwind: "$property"
      },
    
      // property.currency
      {
        $lookup: {
          from: "currencies",
          localField: "property.currency",
          foreignField: "_id",
          as: "property.currency"
        }
      },
      {
        $unwind: "$property.currency"
      },
    
      // property.rating
      {
        $lookup: {
          from: "property_ratings",
          localField: "property.rating",
          foreignField: "_id",
          as: "property.rating"
        }
      },
      {
        $unwind: "$property.rating"
      },
    
      // property.contactinfo.country
      {
        $lookup: {
          from: "countries",
          localField: "property.contactinfo.country",
          foreignField: "_id",
          as: "property.contactinfo.country"
        }
      },
      {
        $unwind: "$property.contactinfo.country"
      },
      // property.contactinfo.city
      {
        $lookup: {
          from: "cities",
          localField: "property.contactinfo.city",
          foreignField: "_id",
          as: "property.contactinfo.city"
        }
      },
      {
        $unwind: "$property.contactinfo.city"
      },

      // property.propertyTypes
      {
        $lookup: {
          from: "property_types",
          localField: "property.type",
          foreignField: "_id",
          as: "property.type"
        }
      },
      {
        $unwind: "$property.type"
      }
    ];

    const roomPopulations = [
      // Guest Numbers
      {
        $lookup: {
          from: "guest_numbers",
          localField: "number_of_guests",
          foreignField: "_id",
          as: "number_of_guests"
        }
      },
      {
        $unwind: "$number_of_guests"
      },

      // Room type
      {
        $lookup: {
          from: "room_types",
          localField: "room_type",
          foreignField: "_id",
          as: "room_type"
        }
      },
      {
        $unwind: "$room_type"
      },

      // Bed type
      {
        $lookup: {
          from: "bed_types",
          localField: "bed_type",
          foreignField: "_id",
          as: "bed_type"
        }
      },
      {
        $unwind: "$bed_type"
      },

      // Services
      {
        $lookup: {
          from: "services",
          localField: "services",
          foreignField: "_id",
          as: "services"
        }
      }
    ];

    const projectionAndGrouping = [
      {
        $project: {
          images: 1,
          featured: 1,
          rates: 1,
          room_type: 1,
          bed_type: 1,
          services: 1,
          number_of_guests: 1,
          property: {
            _id: 1,
            name: 1,
            distance: 1,
            location: 1,
            images: 1,
            featured: 1,
            currency: 1,
            contactinfo: 1,
            charges: 1,
            rating: 1,
            type: 1,
            weekends: 1,
            anyTimeCheckin: 1
          }
        }
      },
      {
        $group: {
          _id: '$property._id',
          property: {$first: '$property'},
          rooms: {
            $push: '$$ROOT'
          }
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
            '$property',
              { rooms: '$rooms' }
            ]
          }
        }
      }
    ];

    // console.log('propertyPopulations', propertyPopulations);
    // console.log('roomPopulations', roomPopulations);
    // console.log('propertiesQuery', JSON.stringify(propertiesQuery));
    // console.log('roomsQuery', JSON.stringify(roomsQuery));

    const roomsAggregateQuery = [
      ...propertyPopulations,
      ...roomPopulations,
      {
        $match: propertiesQuery
      },
      {
        $match: roomsQuery
      },
      ...projectionAndGrouping,
    ];

    // console.log('- roomsAggregateQuery:');
    // console.log(JSON.stringify(roomsAggregateQuery));
    return roomsAggregateQuery;
  },

  populatePropertiesPricing: async (properties, params) => {
    const { bookingType, datesAndHoursParams, priceMin, priceMax } = params;

    // 1. Get Pricing information for the properties
    // - 1.1. Get pricing for each room
    // - 1.2. Remove rooms that reuslt in 0 price, or those that don't match the price filters
    // - 1.3. Copy the lowest room price to the property (copy room.priceSummary to property.priceSummary)
    // 2. Cleanup
    properties = await Promise.all(
      properties.map(async property => {

        // 1. Get Pricing
        // 1.1 Get the Room prices
        await Promise.all(property.rooms.map(async room => await service.getRoomPriceForDates(room, bookingType, datesAndHoursParams)));

        // 1.2 Remove rooms that reuslt in 0 price, or those that don't match the price filters
        property.rooms = property.rooms.filter(room => {
          let isValidRoom = true;

          // Remain Valid if the price is not 0
          isValidRoom = isValidRoom && room.priceSummary && room.priceSummary.base && !!room.priceSummary.base.amount;

          // Remain Valid if the price is matching the filters (if provided)
          if ((priceMin === 0 || !!priceMin) && (priceMax === 0 || !!priceMax)) {

            isValidRoom = isValidRoom &&
              room.priceSummary.base.amount >= priceMin &&
              room.priceSummary.base.amount <= priceMax
            ;
          }

          return isValidRoom;
        });

        // 1.3 Copy cheapest room.priceSummary to property.priceSummary
        if (property.rooms && property.rooms.length) {
          // Start with first room
          let cheapestPrice = property.rooms[0].priceSummary.base.amount;
          property.priceSummary = property.rooms[0].priceSummary;
          // Save the cheapest room's price to the property
          property.rooms.map(room => {
            if (
              room.priceSummary &&
              room.priceSummary.base &&
              room.priceSummary.base.amount &&
              (room.priceSummary.base.amount < cheapestPrice)
            ) {
              property.priceSummary = room.priceSummary;
              cheapestPrice = room.priceSummary.base.amount;
            }
          })
        }

        // 2. Remove / format insecure keys of Property and it's rooms
        delete property.weekends;
        delete property.charges;
        delete property.anyTimeCheckin;
        property.contactinfo = {
          country: property.contactinfo.country,
          city: property.contactinfo.city
        }
        property.rooms.map(room => {
          delete room.rates;
          delete room.property;
          return room;
        })

        return property;
      })
    );

    // 2. Remove properties that don't have rooms (as a result of no pricing)
    properties = properties.filter(p => p.rooms && p.rooms.length);

    return properties;
  },

  /**
   * Calculate and return tax
   * @param
   * tax  Object {
   *  id | String
   *  name | String
   *  chargeType | Enum | 'percentage' or 'number'
   *  value | Number
   * }
   * amount | number
   */
  getCalculatedTax: (tax, amount) => {
    const taxValue = parseInt(tax.value || 0);
    if (taxValue) {
      const chargedTax = tax.chargeType === 'percentage'
        ? amount * (taxValue / 100)
        : taxValue
      ;
      return parseFloat(chargedTax.toFixed(2));
    }

    return 0;
  },

  getFilters: async () => {
    try {
      // - Property Type
      const propertyTypes = await PropertyType.find({}).sort({name: 1}).select('_id name').lean();

      // - Property Star Rating
      const propertyRatings = await PropertyRating.find({}).sort({name: 1}).select('_id name').lean();

      // - Room Type
      const roomTypes = await RoomType.find({}).sort({name: 1}).select('_id name').lean();

      // - Bed Type
      const bedTypes = await BedType.find({}).sort({name: 1}).select('_id name').lean();

      // - Amenities
      const services = await Service.find({}).sort({name: 1}).select('_id name').lean();

      return {
        propertyTypes,
        propertyRatings,
        roomTypes,
        bedTypes,
        services
      };
    } catch (e) {
      console.log('e', e);
      throw new Error(e.message)
    }
  }
};

module.exports = service;
