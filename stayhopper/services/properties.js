const db = require("../db/mongodb");
const Property = require("../db/models/properties");
const UserRating = require("../db/models/userratings");
const BookLog = require("../db/models/bookinglogs");
const Room = require("../db/models/rooms");
const dateTimeService = require("./date-time");
const checkinService = require("./checkin");
const moment = require('moment');
const { property } = require("underscore");

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

  getAvailableProperties: async (params, options) => {
    params = params || {}
    options = options || {}
    const checkinDate = params.checkinDate;
    const checkoutDate = params.checkoutDate;
    const checkinTime = params.checkinTime;
    const checkoutTime = params.checkoutTime;
    const cityId = params.cityId;
    const countryId = params.countryId;
    const numberAdults = params.numberAdults;
    const numberChildren = params.numberChildren;
    const numberRooms = params.numberRooms;
    const properties = params.properties;
    let bookingType;
    const ensureRatesAreDefined = true;

    switch (params.bookingType) {
      case 'hourly':
      case 'short-term':
        bookingType = 'short-term';
        break;
      case 'monthly':
      case 'long-term':
        bookingType = 'long-term';
        break;
      default:
        bookingType = 'short-term';
        break;
    }

    // 1. get hours distribution for all dates of this stay
    const datesAndHoursParams = await checkinService.getDatesAndHoursStayParams({checkinDate, checkoutDate, checkinTime, checkoutTime});
    console.log('datesAndHoursParams', datesAndHoursParams);

    // 2. Get unavailable Room IDs
    const unavailableRoomIds = await service.getUnavailableRoomsIds({checkinDate, checkoutDate, checkinTime, checkoutTime, numberRooms})
    // console.log('unavailableRoomIds', unavailableRoomIds);

    // 3. pagination Query
    const paginationQuery = [
      {
        $skip: 0,
      },
      {
        $limit: 1000
      }
    ]

    // 4. properties Query
    const propertiesQuery = {'$and': []};

    // Property status
    propertiesQuery['$and'].push({'property.approved': true});
    propertiesQuery['$and'].push({'property.published': true});

    // Filter out properties that don't have anyTimeCheckin enabled if the user wants to stay during non-standard hours
    if (!!datesAndHoursParams.find(dh => dh.rateType === 'fullDay')) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      propertiesQuery['$and'].push({
        'property.anyTimeCheckin': true
      })
    }

    // filter specific Country / City
    if (countryId) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      propertiesQuery['$and'].push({
        'property.contactinfo.country._id': countryId
      })
    }

    if (cityId) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      propertiesQuery['$and'].push({
        'property.contactinfo.city._id': cityId
      })
    }

    // Look in the specific properties only
    if (properties && properties.length) {
      propertiesQuery['$and'] = propertiesQuery['$and'] || [];
      propertiesQuery['$and'].push({
        'property._id': {
          $in: properties.map(p => db.Types.ObjectId(p))
        }
      })
    }


    // 5. roomsQuery
    const roomsQuery = {'$and': []};

    // filter only those that have rates defined
    if (ensureRatesAreDefined) {
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

    // Ignore unavailable rooms
    if (unavailableRoomIds && unavailableRoomIds.length) {
      roomsQuery['$and'] = roomsQuery['$and'] || [];
      roomsQuery['$and'].push({
        _id: {
          $nin: unavailableRoomIds
        }
      })
    }

    // 6. Populations & projections
    const propertyPopulations = [
      // property
      {
        $lookup: {
          from: "properties",
          localField: "property_id",
          foreignField: "_id",
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
    ];

    const roomPopulations = [
      // number_of_guests
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
      }
    ];

    const projectionAndGrouping = [
      {
        $project: {
          services: 1,
          images: 1,
          featured: 1,
          rates: 1,
          property: {
            _id: 1,
            name: 1,
            location: 1,
            images: 1,
            featured: 1,
            currency: 1,
            contactinfo: 1,
            rating: 1,
            weekends: 1
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
      },
      {
        $project: {
          'rooms.property': 0
        }
      }
    ];

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
      ...paginationQuery
    ];

    // console.log('propertyPopulations', propertyPopulations);
    // console.log('roomPopulations', roomPopulations);
    // console.log('roomsAggregateQuery', JSON.stringify(roomsAggregateQuery));

    const availableProperties = await Room.aggregate(roomsAggregateQuery)

    let richProperties = await Promise.all(
      availableProperties.map(async property => {
        // TODO
        // 5. Get Pricing information for the properties
        // - 5.1. Get pricing for each room
        // - 5.2. Copy the lowest room price to the property (copy room.priceSummary to property.priceSummary)

        // 5.1 Get the price
        // TODO: Using dummy prices for now, use real values
        property.rooms.map(room => {
          delete room.rates;
          room.priceSummary = {
            base: {
              label: "Base Price",
              amount: 50 + parseInt(Math.random() * 300)
            },
            taxes: {
              breakdown: [
                {
                  label: "VAT 5%",
                  amount: 2.5
                },
                {
                  label: "Tourism Fee",
                  amount: 10
                }
              ],
              label: "Taxes",
              amount: 12.5
            },
            bookingFee: {
              label: "Booking fee",
              amount: 15
            },
            total: {
              label: "Total Amount",
              amount: 77.5
            },
            payNow: {
              label: "Now you pay",
              amount: 15
            },
            payAtHotel: {
              label: "Pay at the hotel",
              amount: 62.5
            }
          }
          return room;
        });

        // 5.2 Copy cheapest room.priceSummary to property.priceSummary
        if (property.rooms && property.rooms.length) {
          let cheapestPrice = 10000;
          property.priceSummary = {};
          property.rooms.map(room => {
            if (room.priceSummary.base.amount < cheapestPrice) {
              property.priceSummary = room.priceSummary;
              cheapestPrice = room.priceSummary.base.amount;
            }
          })
        }

        // 5. Get User Ratings information for the properties
        // - Populate ratings in properties
        property = await service.getPropertyRating(property);

        return property;
      })
    );

    if (options) {
      // Sorting
      if (options.sort && options.sort === 'userRatings') {
        // Sort Properties as per their ratings
        richProperties = richProperties
          .sort((a, b) => {
            if (a.userRating < b.userRating) { return -1}
            if (a.userRating > b.userRating) { return 1}
            return 0;
          })
          .reverse()
        ;
      } else if (options.sort && options.sort === 'price') {
        // Sort Properties as per their ratings
        richProperties = richProperties
          .sort((a, b) => {
            if (a.priceSummary.base < b.priceSummary.base) { return -1}
            if (a.priceSummary.base > b.priceSummary.base) { return 1}
            return 0;
          })
          .reverse()
        ;
      }

      // Sorting
      if (options.limit) {
        richProperties = richProperties.splice(0, options.limit);
      }
    }

    return richProperties;
  },

  getPopularProperties: async params => {
    params = params || {};
    const popularPropertiesCount = 10;

    try {
      const numberOfHours = 6;
      const checkinTimeMoment = dateTimeService.getNearestCheckinTimeMoment();
      const checkoutTimeMoment = moment(checkinTimeMoment).add(numberOfHours, "hours");

      const checkinTime = checkinTimeMoment.format("HH:mm"); // use next 30 minute slot from now
      const checkoutTime = checkoutTimeMoment.format("HH:mm"); // use {numberOfHours} hours from checkinTime
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

      let properties = await service.getAvailableProperties({
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
      }, {
        sort: 'userRatings',
        limit: popularPropertiesCount
      })

      return properties;
    } catch (e) {
      console.log('e', e);
      throw new Error(e.message)
    }
  },

  // Get Cheapest Properties
  getCheapestProperties: async params => {
    params = params || {};
    const cheapestPropertiesCount = 10;

    try {
      const numberOfHours = 3;

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

      let properties = await service.getAvailableProperties({
        checkinDate,
        checkoutDate,
        checkinTime,
        checkoutTime,
        bookingType: 'hourly', // hourly or monthly
        cityId: params.cityId || '',
        countryId: params.countryId || '',
        numberAdults: params.numberAdults || 2,
        numberChildren: params.numberChildren || 0,
        numberRooms: params.numberRooms || 1
      }, {
        sort: 'price',
        limit: cheapestPropertiesCount
      });

      // console.log('properties.length', properties.length);
      return properties;
    } catch (e) {
      console.log('e', e);
      throw new Error(e.message)
    }
  }
};

module.exports = service;
