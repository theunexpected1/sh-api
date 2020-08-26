const mongoose = require('mongoose');
const db = require("../../../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const path = require("path");
const paginate = require("express-paginate");
const config = require("config");
const sharp = require('sharp');
const request = require('request');

const Country = require("../../../db/models/countries");

const Property = require("../../../db/models/properties");
const Room = require("../../../db/models/rooms");
const Role = require("../../../db/models/roles");
const Administrator = require("../../../db/models/administrators");
const Booking = require("../../../db/models/bookings");
const BookLog = require("../../../db/models/bookinglogs");
const Slot = require("../../../db/models/slots");

const _ = require("underscore");
const moment = require("moment");
const jwtMiddleware = require("../../../middleware/jwt");

// START: Customize
const ModuleTitle = "Room";
const ModuleModel = Room;
const selections = '';
const populations = [
  {
    path: "property_id"
  },
  {
    path: "property"
  },
  {
    path: "room_type"
  },
  {
    path: "room_name"
  },
  {
    path: "bed_type"
  },
  {
    path: "services"
  },
  {
    path: 'number_of_guests'
  }
];

const singlePopulations = [
  {
    path: "property_id",
    populate: [
      {
        path: "rating"
      },
      {
        path: "company"
      },
      {
        path: "administrator"
      },
      {
        path: "rooms"
      },
      {
        path: "type"
      },
      {
        path: "contactinfo.country"
      },
      {
        path: "contactinfo.city"
      },
      {
        path: "policies"
      },
      {
        path: "terms"
      },
      {
        path: "currency"
      },
      {
        path: "payment.country"
      },
      {
        path: "payment.currency"
      }
    ]
  },
  {
    path: "property"
  },
  {
    path: "room_type"
  },
  {
    path: "room_name"
  },
  {
    path: "bed_type"
  },
  {
    path: "services"
  },
  {
    path: 'number_of_guests'
  }
];

const hasPermissions = (req, res) => {
  // Permissions

  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_ROOMS) > -1;
  if (hasResourceAccess) {
    return true;
  } else {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
    return false;
  }
}

const prepareQueryForListing = (req) => {
  const where = {};

  let propertyId = req.query.propertyId;

  if (propertyId) {
    where.property_id = propertyId;
  }

  return where;
}

// Upload for Photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/files/original/rooms");
  },
  filename: (req, file, cb) => {
    var ext = (path.extname(file.originalname) || '').toLowerCase();
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});

let upload = pify(
  multer({
    storage: storage,
    fileFilter: function(req, file, callback) {
      var ext = (path.extname(file.originalname) || '').toLowerCase();
      if (
        ext !== ".svg" &&
        ext !== ".png" &&
        ext !== ".jpg" &&
        ext !== ".gif" &&
        ext !== ".jpeg"
      ) {
        return callback(new Error("Only images are allowed"));
      }
      callback(null, true);
    }
  }).array("file")
);

const preCreateOrUpdate = async (req, res, resourceData) => {
  try {

    // Ensure no extra beds are provided if the option is disabled
    if (!resourceData.extrabed_option) {
      resourceData.extrabed_number = 0;
    }

    return resourceData;
  } catch (e) {
    console.log('e', e);
    throw new Error("Could not upload");
  }
}

// END: Customize


// Generic Listing+CRUD

const list = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      // Where condition
      const where = prepareQueryForListing(req);

      // Pagination
      let active_page = 1;
      if (req.query.page) {
        active_page = req.query.page;
      }

      // Sorting
      let sort = { _id: 1 };
      if (req.query.order && req.query.orderBy) {
        sort = {};
        sort[req.query.orderBy] = req.query.order === 'asc' ? 1 : -1;
      }

      let [list, itemCount] = await Promise.all([
        ModuleModel
          .find(where)
          .select(selections || '')
          .populate(populations || '')
          .sort(sort)
          .limit(req.query.limit)
          .skip(req.skip)
          .lean()
          .exec(),
        ModuleModel.countDocuments(where)
      ]);

      const pageCount = Math.ceil(itemCount / req.query.limit);
      let data = {
        list: list,
        itemCount: itemCount,
        pageCount: pageCount,
        pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
        active_page
      };
      res.status(200).send(data).end();
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};

const single = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let where = {_id: req.params.id};
      const [resource] = await Promise.all([
        ModuleModel
          .findOne(where)
          .select(selections)
          .populate(singlePopulations)
          .lean()
          .exec()
      ]);

      if (!resource) {
        return res.status(404).send({
          message: `${ModuleTitle} does not exist`
        }).end();
      }

      res.status(200).send(resource).end();
    } catch (e) {
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}


const create = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      // Pre call could be anything to be done before a POST / PUT is performed
      // This could also be empty
      let resourceData = req.body;
      resourceData = await preCreateOrUpdate(req, res, resourceData);

      const resource = new ModuleModel(resourceData);
      await resource.save()
      await ModuleModel.populate(resource, singlePopulations);

      if (resource) {
        res.status(200).send(resource).end();
      } else {
        res.status(500).send({
          message: 'Sorry, there was an error in performing this action'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action',
        error: e
      }).end();
    }
  }
}

const modify = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      // Pre call could be anything to be done before a POST / PUT is performed
      // This could also be empty
      let resourceData = req.body;
      resourceData = await preCreateOrUpdate(req, res, resourceData);

      let where = {_id: req.params.id};  
      const resource = await ModuleModel.findOne(where);
      if (resource) {
        Object.keys(resourceData).map(key => resource[key] = resourceData[key]);
        await resource.save();
        await ModuleModel.populate(resource, singlePopulations);
        res.status(200).send(resource).end();
      } else {
        res.status(404).send({
          message: 'Sorry, resource does not exist'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}

const remove = async (req, res) => {
  if (hasPermissions(req, res)) {
    let where = {_id: req.params.id};
    try {
      // Return updated doc
      const resource = await ModuleModel.deleteOne(where).exec();
      res.status(200).send(resource).end();
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this operation'
      }).end();
    }
  }
}



/** Rates */
const createRate = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let resourceData = req.body || {};

      let where = {_id: req.params.id};
      const resource = await ModuleModel.findOne(where);
      if (resource) {
        const rate = resource.rates.create(resourceData);
        resource.rates.push(rate);
        await resource.save()

        res.status(200).send(rate).end();
      } else {
        res.status(404).send({
          message: 'Sorry, resource does not exist'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action',
        error: e
      }).end();
    }
  }
}

const modifyRate = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let resourceData = req.body || {};
      if (!req.params.rateId) {
        return res.status(500).send({
          message: 'Sorry, no Rate specified to modify'
        });
      }

      let where = {
        _id: req.params.id,
        'rates._id': req.params.rateId
      };

      const resource = await ModuleModel.findOne(where);
      if (resource) {
        const rate = resource.rates.id(req.params.rateId);
        rate.set(resourceData);
        await resource.save();
        res.status(200).send(rate).end();
      } else {
        res.status(404).send({
          message: 'Sorry, resource does not exist'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action',
        error: e
      }).end();
    }
  }
}

const removeRate = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      if (!req.params.rateId) {
        return res.status(500).send({
          message: 'Sorry, no Rate specified to remove'
        });
      }

      let where = {
        _id: req.params.id,
        'rates._id': req.params.rateId
      };

      const resource = await ModuleModel.findOne(where);
      if (resource) {
        resource.rates.pull(req.params.rateId);
        await resource.save();

        res.status(200).send(resource).end();
      } else {
        res.status(404).send({
          message: 'Sorry, resource does not exist'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this operation'
      }).end();
    }
  }
}


/** Availability **/
const getSlotRanges = (slots, status, date, momentTimezoneStr) => {
  const ranges = [];
  // 1. sort slots
  const sortedSlots = slots.sort((a, b) => {
    a.slot.label = a.slot.label || '';
    b.slot.label = b.slot.label || '';
    if(a.slot.label.trim().toLowerCase() < b.slot.label.trim().toLowerCase()) { return -1; }
    if(a.slot.label.trim().toLowerCase() > b.slot.label.trim().toLowerCase()) { return 1; }
    return 0;
  })

  const defaultRangeItem = {
    slots: [],
    status
  }
  let rangeItem = JSON.parse(JSON.stringify(defaultRangeItem));
  const thirtyMins = 30 * 60 * 1000;

  // Retain timezone of the property
  const momentDate = moment.tz(date, momentTimezoneStr);

  // 2. Do Magic
  sortedSlots.map(slotItem => {
    if (!!slotItem[status]) {
      const labelSplit = slotItem.slot['label'].split(':');
      // Use Moment - To retain time zone for Property's Country
      const startMt = moment(momentDate);
      startMt.set({
        hours: labelSplit[0],
        minutes: labelSplit[1]
      });
      const end = new Date(startMt.toDate().getTime() + thirtyMins);
      if (!rangeItem['start']) {
        rangeItem['start'] = startMt.toDate();
        rangeItem['end'] = end;
      } else {
        rangeItem['end'] = end;
      }

      // Use Date - to disregard time zone - Doesn't work as expected
      // const start = new Date(date);
      // console.log('start new Date(date)', start);
      // start.setHours(labelSplit[0], labelSplit[1], 0, 0);
      // console.log('start setHours', labelSplit[0], labelSplit[1], start);
      // const end = new Date(start.getTime() + thirtyMins);
      // console.log('end ................', end);
      // if (!rangeItem['start']) {
      //   rangeItem['start'] = start;
      //   rangeItem['end'] = end;
      // } else {
      //   rangeItem['end'] = end;
      // }
      rangeItem.slots.push(slotItem.slot)
    } else {
      // Not valid? Chain active? Save data and break the chain
      if (rangeItem['start']) {
        ranges.push(rangeItem);
        rangeItem = JSON.parse(JSON.stringify(defaultRangeItem));
      }
      // Not valid? Chain is NOT active? we don't need to do anything
    }
  })

  // If we have some pending stuff, close it as we have all we need and take it home
  if (rangeItem['start']) {
    ranges.push(rangeItem);
  }

  return ranges;
}

const listAvailability = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      const date = req.query.date;

      let where = {_id: req.params.id};
      const [resource] = await Promise.all([
        ModuleModel
          .findOne(where)
          .select(selections)
          .populate(singlePopulations)
          .lean()
          .exec()
      ]);

      if (!resource) {
        return res.status(404).send({
          message: `${ModuleTitle} does not exist`
        }).end();
      }

      // Get Timezone string
      let tzs = moment.tz.zonesForCountry('ae');
      const resourceCountry = resource.property_id && resource.property_id.contactinfo && resource.property_id.contactinfo.country
        ? resource.property_id.contactinfo.country.country
        : ''
      ;

      if (resourceCountry) {
        if (['uae', 'united arab emirates'].indexOf(resourceCountry.toLowerCase()) > -1) {
          tzs = moment.tz.zonesForCountry('ae');
        } else if (['india'].indexOf(resourceCountry.toLowerCase()) > -1) {
          tzs = moment.tz.zonesForCountry('in');
        } else if (['vietnam'].indexOf(resourceCountry.toLowerCase()) > -1) {
          tzs = moment.tz.zonesForCountry('vn');
        }
      }
      let momentTimezoneStr = tzs.length ? tzs[0] : 'Asia/Dubai';

      const bookings = await Booking.findOne({ room: req.params.id, date: date }).populate("slots.slot");
      let bookingArray = [];
      if (typeof bookings != "undefined" && bookings != null) {
        if (typeof bookings.slots != "undefined")
          bookingArray = _.toArray(bookings.slots);
      }
      const slots = await Slot.find().sort({ _id: 1 });
      let slotStatuses = [];

      for (let i=0; i < resource.number_rooms; i++) {
        slotStatuses[i] = slotStatuses[i] || [];

        slots.forEach((slot)=>{ 
          blocked = false;
          booked = false;
          reserved = false;
          const slotStatusForRoom = {
            _id: slot._id,
            slot,
            booked: false,
            blocked: false,
            reserved: false,
          };
          // slotStatuses[i][slot._id] = {
          //   booked: false,
          //   blocked: false,
          //   reserved: false,
          //   slot
          // };
          var arr = _.filter(bookingArray, function(obj) {
              if(obj.slot.no == slot.no && obj.number==(i+1) && (obj.status=='BLOCKED')){
                return obj;
              }
          });
          if(arr.length){
            slotStatusForRoom['blocked'] = true;
            blocked = true;
          }
          var booked_arr = _.filter(bookingArray, function(obj) {
            if(obj.slot.no == slot.no && obj.number==(i+1) && (obj.status=='BOOKED')){
              return obj;
            }
          });
          if(booked_arr.length > 0){
            booked = true;
            slotStatusForRoom['booked'] = true;
          }
          var reserved_arr = _.filter(bookingArray, function(obj) {
            if(obj.slot.no == slot.no && obj.number==(i+1) && (obj.status=='RESERVED')){
              return obj;
            }
          });
          if(reserved_arr.length > 0){
            reserved = true;
            slotStatusForRoom['reserved'] = true;
          }
          slotStatuses[i].push(slotStatusForRoom)
        });
      }

      const slotStatusesRanges = slotStatuses.map(slotStatusesItem => {
        const booked = getSlotRanges(slotStatusesItem, 'booked', date, momentTimezoneStr)
        const reserved = getSlotRanges(slotStatusesItem, 'reserved', date, momentTimezoneStr)
        const blocked = getSlotRanges(slotStatusesItem, 'blocked', date, momentTimezoneStr);
        const combinedStatusRanges = [].concat(booked, reserved, blocked);
        return combinedStatusRanges;
      });

      let data = {
        list: slotStatusesRanges,
        // slotStatuses,
        slots
      };
      res.status(200).send(data).end();
    } catch (e) {
      console.log('e', e);
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};

const changeAvailability = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      const room_id = req.body.room;
      const property_id = req.body.property;

      const dates = req.body.dates;
      const slotIds = req.body.slotIds;
      const action = req.params.action;
      const nos = req.body.nos;

      let room = await Room.findOne({ _id: room_id }).sort({ _id: 1 });
      let slots = await Slot.find({_id: {$in:slotIds}}).sort({ _id: 1 }).exec();

      if (room && slots && slots.length && dates && dates.length) {
        const bookLogInsertRecords = [];
        let shouldExecuteBookLogInsert = false;
        let shouldExecuteBookLogDelete = false;

        // Method 1
        let bookLogDeleteRecordsQuery = [];

        // Method 2
        // const bookLogDeleteRecordsQuery = {
        //   $or: []
        // };

        await Promise.all(dates.map(async date => {
          const dateStampFormat = new Date(
            moment(new Date(date)).format("YYYY-MM-DD")
          );
          let where = {
            room: room._id,
            date: date
          };
          let booking = await Booking.findOne(where);
          if (!booking) {
            booking = new Booking();
            booking.slots = [];
          }

          booking.property = room.property_id;
          booking.room = room._id;
          booking.date = date;

          // Has slots
          if (booking.slots && booking.slots.length) {
            if (action === 'block') {
              nos.map(no => {
                const unavailableSlotIds = booking.slots
                  .filter(slot => slot.status !== "BLOCKED" && slot.number === no)
                  .map(slot => slot._id)
                ;
                const availableSlots = slotIds.filter(slotId => unavailableSlotIds.indexOf(slotId) === -1);

                availableSlots.map(slotId => {
                  // Block Booking.slots
                  booking.slots.push({
                    slot: slotId,
                    number: no,
                    status: "BLOCKED"
                  });

                  // Save BookLogs
                  const record = {
                    property: room.property_id,
                    room: room._id,
                    slot: slotId,
                    number: no,
                    date: date,
                    timestamp: dateStampFormat
                  };
                  bookLogInsertRecords.push(record);
                  shouldExecuteBookLogInsert = true;
                });
              });

              console.time(`Sc1. BlockAction - ${date}`);
              await booking.save();
              console.timeEnd(`Sc1. BlockAction - ${date}`);

            } else if (action === 'unblock') {
              let updatedBookingSlots = [];

              const individualBookingLogs = {
                $or: []
              };

              updatedBookingSlots = updatedBookingSlots.concat(
                booking.slots
                  .filter( bookingSlot => {
                    const isAValidBookingSlot = !(
                      slotIds.indexOf(bookingSlot.slot.toString()) > -1 &&
                      nos.indexOf(bookingSlot.number) > -1 &&
                      bookingSlot.status == "BLOCKED")
                    ;

                    if (!isAValidBookingSlot) {
                      shouldExecuteBookLogDelete = true;
                      // Method 1
                      individualBookingLogs['$or'].push({
                        room: room._id,
                        slot: bookingSlot.slot,
                        date: date,
                        number: bookingSlot.number
                      });

                      // Method 2
                      // bookLogDeleteRecordsQuery['$or'].push({
                      //   room: room._id,
                      //   slot: bookingSlot.slot,
                      //   date: date,
                      //   number: bookingSlot.number
                      // })
                    }

                    return isAValidBookingSlot;
                  })
                )
              ;

              // console.time(`UnblockAction Save Individual Bookings per date ${date}`);
              // Method 1 - Prepare IDs with single Find()
              const bls = await BookLog.find(individualBookingLogs).lean();
              if (bls && bls.length) {
                bookLogDeleteRecordsQuery = bookLogDeleteRecordsQuery.concat(bls.map(bookingLog => bookingLog._id));
              }
              // console.log('batch bookLogDeleteRecordsQuery', bookLogDeleteRecordsQuery);
              console.log('batch bookLogDeleteRecordsQuery.length', bookLogDeleteRecordsQuery.length);

              // Method 2 - Prepare IDs with multiple findOnes()
              // await Promise.all(bookingLogQueriesToDelete.map(async bl => {
              //   const bookingLog = await BookLog.findOne(bl).lean();
              //   if (bookingLog) {
              //     bookLogDeleteRecordsQuery.push(bookingLog._id);
              //   }
              // }));
              // console.log('batch bookLogDeleteRecordsQuery', bookLogDeleteRecordsQuery.length);
              // console.timeEnd(`UnblockAction Save Individual Bookings per date ${date}`);

              booking.slots = updatedBookingSlots;
              await booking.save();
            }
          } else {
            if (action === 'block') {
              nos.map(no => {
                slotIds.map(slotId => {
                  // Block Booking.slots
                  booking.slots.push({
                    slot: slotId,
                    number: no,
                    status: "BLOCKED"
                  });

                  // Save BookLogs
                  const record = {
                    property: room.property_id,
                    room: room._id,
                    slot: slotId,
                    number: no,
                    date: date,
                    timestamp: dateStampFormat
                  };
                  bookLogInsertRecords.push(record);
                  shouldExecuteBookLogInsert = true;
                });
              });
              // console.log('booking.slots', booking.slots);
              console.time(`Sc2. BlockAction - ${date}`);
              await booking.save();
              console.timeEnd(`Sc2. BlockAction - ${date}`);
            }
          }
        }));

        if (shouldExecuteBookLogInsert) {
          await BookLog.insertMany(bookLogInsertRecords);
        }

        if (shouldExecuteBookLogDelete) {
          console.time(`UnblockAction DeleteMany`);
          // Method 1
          await BookLog.deleteMany({
            _id: {$in: bookLogDeleteRecordsQuery}
          });

          // Method 2
          // console.log('bookLogDeleteRecordsQuery.length', bookLogDeleteRecordsQuery['$or'].length);
          // await BookLog.deleteMany(bookLogDeleteRecordsQuery);
          console.timeEnd(`UnblockAction DeleteMany`);
        }

        if (action === 'block') {
          res.status(200).send({
            message: 'Time slots are blocked successfully'
          }).end();
        } else {
          res.status(200).send({
            message: 'Time slots are unblocked successfully'
          }).end();
        }
      } else {
        return res.json({
          status: 0,
          data: "Some error occured. Please contact administrator"
        });
      }
    } catch (e) {
      console.log('e', e);
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}


/** Photos */
const createPhoto = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let image = null;
      let where = {_id: req.params.id};
      let resource = await ModuleModel.findOne(where);
      if (req.files && resource) {
        let api_url = config.api_url;
        filename = path.basename(req.files[0].path);
        if (filename) {
          const resizer = sharp()
            .resize(800)
            .toFile('public/files/rooms/' + filename, async (err, info) => {
              console.log('err: ', err);
              console.log('info: ', info);

              if (err) {
                res.status(500).send({
                  message: 'Sorry, there was an error in performing this action'
                }).end();
              } else {
                image = 'public/files/rooms/'+filename;

                let images = resource.images;
                // let featured_images = resource.featured;
                // if((typeof featured_images != 'undefined' && featured_images.length <= 0) || typeof featured_images == 'undefined'){
                //   featured_images = [image]
                //   resource.featured = featured_images;
                //   featured = true;
                // }
                if (images) {
                  images.push(image);
                } else {
                  images = [image];
                }
                resource.images = images;
                await resource.save();
                res.status(200).send({
                  images: resource.images,
                  featured: resource.featured
                }).end();
              }
            })
          ;
          request(api_url + req.files[0].path).pipe(resizer);
        } else {
          res.status(500).send({
            message: 'Sorry, there was an error in performing this action'
          }).end();
        }
      } else {
        return res.status(404).send({
          message: 'Sorry, resource does not exist'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}

const removePhoto = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let image = req.body.image;
      let where = {_id: req.params.id};
      let resource = await ModuleModel.findOne(where);
      if (resource.images && resource.images.length > 0) {
        let index = null;
        images = resource.images.filter(i => i !== image);
        resource.images = images;
        await resource.save();
        res.status(200).send({
          images: resource.images,
          featured: resource.featured
        }).end();
      } else {
        res.status(404).send({
          message: `Resource does not exist`
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}

const featurePhoto = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let image = req.body.image;
      let where = {_id: req.params.id};
      let resource = await ModuleModel.findOne(where);
      let status = 1;
      let featured = [image];
      resource.featured = featured;
      let images = resource.images;
      images = _.without(images, image);      
      images.unshift(image);
      resource.images = images;
      await resource.save();
      res.status(200).send({
        images: resource.images,
        featured: resource.featured
      }).end();
    } catch (e) {
      console.log('e', e);
      res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
}
router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), list);
router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), single);
router.post("/", jwtMiddleware.administratorAuthenticationRequired, upload, create);
router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, upload, modify);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);

router.post("/:id/rates", jwtMiddleware.administratorAuthenticationRequired, upload, createRate);
router.put("/:id/rates/:rateId", jwtMiddleware.administratorAuthenticationRequired, upload, modifyRate);
router.delete("/:id/rates/:rateId", jwtMiddleware.administratorAuthenticationRequired, removeRate);

router.get("/:id/availability", jwtMiddleware.administratorAuthenticationRequired, upload, listAvailability);
router.post("/:id/availability/:action", jwtMiddleware.administratorAuthenticationRequired, upload, changeAvailability);

router.post("/:id/photos", jwtMiddleware.administratorAuthenticationRequired, upload, createPhoto);
router.post("/:id/photos/feature", jwtMiddleware.administratorAuthenticationRequired, featurePhoto);
// post, not delete, because we're sending image url in post data
router.post("/:id/photos/remove", jwtMiddleware.administratorAuthenticationRequired, removePhoto);


module.exports = router;
