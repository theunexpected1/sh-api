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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/files/original/rooms");
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});

let upload = pify(
  multer({
    storage: storage,
    fileFilter: function(req, file, callback) {
      var ext = path.extname(file.originalname);
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

    // resourceData.trade_licence = resourceData.trade_licence || {};
    // // Set the newly uploaded file in the resource body
    // if (req.files['trade_licence[trade_licence_attachment]']) {
    //   resourceData.trade_licence.trade_licence_attachment = req.files['trade_licence[trade_licence_attachment]'][0].path || null;
    // }

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
          message: 'Sorry, no Rate specified to modify'
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
const getSlotRanges = (slots, status, date) => {
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

  // 2. Do Magic
  sortedSlots.map(slotItem => {
    if (!!slotItem[status]) {
      const labelSplit = slotItem.slot['label'].split(':');
      const start = new Date(date);
      start.setHours(labelSplit[0], labelSplit[1], 0, 0);
      const end = new Date(start.getTime() + thirtyMins);
      if (!rangeItem['start']) {
        rangeItem['start'] = start;
        rangeItem['end'] = end;
      } else {
        rangeItem['end'] = end;
      }
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
        const booked = getSlotRanges(slotStatusesItem, 'booked', date)
        const reserved = getSlotRanges(slotStatusesItem, 'reserved', date)
        const blocked = getSlotRanges(slotStatusesItem, 'blocked', date);
        const combinedStatusRanges = [].concat(booked, reserved, blocked);
        return combinedStatusRanges;
      });

      let data = {
        list: slots,
        slotStatuses,
        slotStatusesRanges
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
      const date = req.body.date;
      const slotsData = req.body.slots;
      const action = req.params.action;
      const slotIds = slotsData.map(s => s._id);

      let room = await Room.findOne({ _id: room_id }).sort({ _id: 1 });
      let slots = await Slot.find({_id: {$in:slotIds}}).sort({ _id: 1 }).exec();

      if (room && slots && slots.length && date) {
        let where = {
          room: room._id,
          date: date
        };
        let booking = await Booking.findOne(where);
        if (!booking) {
          booking = new Booking();
        }

        booking.property = room.property_id;
        booking.room = room._id;
        booking.date = date;

        if (booking.slots) {

          if (action === 'block') {
            for (i in slotsData) {
              booking.slots.push({
                slot: slotsData[i]._id,
                number: slotsData[i].no,
                status: "BLOCKED"
              });
            }
            
          } else if (action === 'unblock') {
            let pull = [];
            let deleteBookLogSlotIds = []
            for (i in slotsData) {
              const blockedSlotsInBooking = booking.slots
                .filter(bookingSlot => {
                  return bookingSlot.slot == slotsData[i]['_id'] &&
                    bookingSlot.number === slotsData[i]['no'] &&
                    bookingSlot.status == "BLOCKED"
                  ;
                })
                .map(s => {
                  return {
                    number: slotsData[i]['no'],
                    slot: slotsData[i]['_id']
                  }
                })
              ;

              const pullArr = JSON.parse(JSON.stringify(blockedSlotsInBooking));
              deleteBookLogSlotIds = deleteBookLogSlotIds.concat(pullArr.map(p => p.slot));
              pull = pull.concat(blockedSlotsInBooking);
            }

            // console.log('booking', booking._id);
            // console.log('pulling from booking', pull);
            // console.log('deleteBookLogSlotIds', deleteBookLogSlotIds);

            pull.map(async p => {
              await Booking.update(
                { _id: booking._id },
                { $pull: { slots: { number: p.number, slot: p.slot} } }
              );
              await BookLog.deleteOne({
                slot: db.Types.ObjectId(p.slot),
                room: db.Types.ObjectId(room._id),
                date: date,
                number: parseInt(p.number)
              });
            });
            res.status(200).send({
              message: 'Time slots are unblocked successfully'
            }).end();
          }
        } else {
          if (action === 'block') {
            for (i in slotsData) {
              booking.slots.push({
                slot: slotsData[i]._id,
                number: slotsData[i].no,
                status: "BLOCKED"
              });
            }
          }
        }

        if (action === 'block') {
          for (i in slotsData) {
            let bookinglog = new BookLog();
            bookinglog.property = room.property_id;
            bookinglog.room = room._id;
            bookinglog.slot = slotsData[i]._id;
            bookinglog.number = slotsData[i].no;
            bookinglog.date = date;
            bookinglog.timestamp = new Date(
              moment(new Date(date)).format("YYYY-MM-DD")
            );
            await bookinglog.save();
          }

          await booking.save();
          res.status(200).send({
            message: 'Time slots are blocked successfully'
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



router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), list);
router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), single);
router.post("/", jwtMiddleware.administratorAuthenticationRequired, upload, create);
router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, upload, modify);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);

router.post("/:id/rates", jwtMiddleware.administratorAuthenticationRequired, upload, createRate);
router.put("/:id/rates/:rateId", jwtMiddleware.administratorAuthenticationRequired, upload, modifyRate);
router.delete("/:id/rates/:rateId", jwtMiddleware.administratorAuthenticationRequired, removeRate);

router.get("/:id/availability", jwtMiddleware.administratorAuthenticationRequired, upload, listAvailability);
router.post("/:id/availability/:action", jwtMiddleware.administratorAuthenticationRequired, upload, changeAvailability);


module.exports = router;
