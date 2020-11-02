const express = require("express");
const router = express.Router();
const paginate = require("express-paginate");
const config = require("config");
const moment = require("moment");

const Booking = require("../../../db/models/bookings");
const BookLog = require("../../../db/models/bookinglogs");
const UserBookings = require("../../../db/models/userbookings");
const CompletedBookings = require("../../../db/models/completedbookings");
const Property = require("../../../db/models/properties");
const UserBooking = require("../../../db/models/userbookings");
const User = require("../../../db/models/users");
const jwtMiddleware = require("../../../middleware/jwt");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const fs = require("fs");

// START: Customize
const ModuleTitle = "Bookings";
// We'll switch between UserBookings or CompletedBookings
const selections = '';
const populations = [
  {
    path: "user"
  },
  {
    path: "room.room",
    populate: [
      {
        path: "room_name"
      },
      {
        path: "room_type"
      }
    ]
  },
  {
    path: "property"
  }
];

const hasPermissions = (req, res) => {
  // Permissions
  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_BOOKINGS) > -1;
  if (hasResourceAccess) {
    return true;
  } else {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
    return false;
  } 
}

const prepareQueryForListing = async (req) => {

  // Further permissions
  let user = req.user;
  let {permissions} = user.role;
  const hasAllBookingsAccess = permissions.indexOf(config.permissions.LIST_ALL_BOOKINGS) > -1;
  const hasOwnBookingsAccess = permissions.indexOf(config.permissions.LIST_OWN_BOOKINGS) > -1;

  const where = {};
  const property = req.query.property;
  const userFilter = req.query.user;
  const date = req.query.date;
  const status = req.query.status;

  // Filter: User's Bookings - Restrict to logged in user viewing their own Bookings if they dont have access to all
  if (hasOwnBookingsAccess && !hasAllBookingsAccess) {
    where['$and'] = where['$and'] || [];
    const uniqueOrQuery = [];

    // get properties that this user has access to, and then set those property IDs as a where clause for invoices
    const propertiesWithAccess = await Property.find({
      $or: [
        {
          administrator: user._id
        }, {
          allAdministrators: {
            $in: [user._id]
          }
        }
      ]
    });

    if (status === 'active') {
      uniqueOrQuery.push({property: {
        $in: propertiesWithAccess.map(p => p._id)
      }});
    } else {
      uniqueOrQuery.push({'propertyInfo.id': {
        $in: propertiesWithAccess.map(p => p._id)
      }});
    }

    where['$and'].push({$or: uniqueOrQuery});

    // Restrict only to paid bookings
    where['paid'] = true;
  }

  // Filter: Property
  if (property) {
    if (status === 'active') {
      where['property'] = property;
    } else {
      where['propertyInfo.id'] = property;
    }
  }

  // Filter: User
  if (userFilter) {
    where.user = userFilter;
  }

  // Filter: Date
  if (date) {
    where.checkin_date = moment(new Date(date)).format('YYYY-MM-DD');
  }

  // Filter: status
  // if (status) {
  //   where.status = status;
  // }

  return where;
}

const preCreateOrUpdate = async (req, res, resourceData) => {
  return resourceData;
}

// END: Customize


// Generic Listing+CRUD
const list = async (req, res) => {
  // if (hasPermissions(req, res)) {
    try {
      // Where condition
      const where = await prepareQueryForListing(req);
      const status = req.query.status;
      const ModuleModel = !status || status === 'active' ? UserBookings : CompletedBookings

      // console.log('where', JSON.stringify(where));

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

      let resources = await ModuleModel.find(where).sort(sort).populate(populations).exec()
      const isAsc = req.query.order === 'asc';
      if (req.query.orderBy === 'property') {
        resources = resources
          .sort((a, b) => {
            if (a.propertyInfo.name.trim().toLowerCase() < b.propertyInfo.name.trim().toLowerCase()) { return isAsc ? -1 : 1; }
            if (a.propertyInfo.name.trim().toLowerCase() > b.propertyInfo.name.trim().toLowerCase()) { return isAsc ? 1 : -1; }
            return 0;
          })
          .splice(req.skip, req.query.limit)
        ;
      } else {
        resources = resources
          .splice(req.skip, req.query.limit)
        ;
      }
    
      /**
        Manual sorting as we cannot traditionally sort by property.name
        ModuleModel
          .find(where)
          .select(selections || '')
          .populate(populations || '')
          .sort(sort)
          .limit(req.query.limit)
          .skip(req.skip)
          .lean()
          .exec(),
       */

      let user = req.user;
      let {permissions} = user.role;
      const hasAllBookingsAccess = permissions.indexOf(config.permissions.LIST_ALL_BOOKINGS) > -1;

      const [properties, users, list, itemCount] = await Promise.all([
        hasAllBookingsAccess
          ? Property.find({}).sort({name: 1}).select('_id').select('name')
          : Property.find({
            $or: [
              {administrator: user._id},
              {allAdministrators: {
                $in: [user._id]
              }}
            ]
          }).sort({name: 1}).select('_id').select('name')
        ,
        // hasAllBookingsAccess ? User.find({}).sort({name: 1}) : Promise.resolve([]),
        // Don't get Users
        Promise.resolve([]),
        Promise.resolve(resources),
        ModuleModel.countDocuments(where)
      ]);

      const pageCount = Math.ceil(itemCount / req.query.limit);
      let data = {
        list: list,
        properties,
        users,
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
  // }
};

const single = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      let where = {_id: req.params.id};
      const status = req.params.status;
      const ModuleModel = !status || status === 'active' ? UserBookings : CompletedBookings

      const [resource] = await Promise.all([
        ModuleModel
          .findOne(where)
          .select(selections)
          .populate(populations)
          .lean()
          .exec()
      ]);

      if (!resource) {
        return res.status(404).send({
          message: `${ModuleTitle} does not exist`
        }).end();
      }

      // // Forbid accessing other's invoice
      // let user = req.user;
      // let {permissions} = user.role;
      // const hasAllBookingsAccess = permissions.indexOf(config.permissions.LIST_ALL_BOOKINGS) > -1;
      // const hasOwnBookingsAccess = permissions.indexOf(config.permissions.LIST_OWN_BOOKINGS) > -1;
      // if (hasOwnBookingsAccess && !hasAllBookingsAccess && resource.property) {
      //   const propertyAllAdministrators = resource.property.allAdministrators.map(a => a.toString());
      //   if (
      //     resource.property.administrator.toString() !== req.user._id.toString() &&
      //     propertyAllAdministrators.indexOf(req.user._id.toString()) === -1
      //   ) {
      //     res.status(401).send({
      //       message: 'Sorry, you do not have access to this resource'
      //     }).end();
      //   }
      // }

      res.status(200).send(resource).end();
    } catch (e) {
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};

/**
const create = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      // Pre call could be anything to be done before a POST / PUT is performed
      // This could also be empty
      let resourceData = req.body;
      resourceData = await preCreateOrUpdate(req, res, resourceData);

      const resource = new ModuleModel(resourceData);
      await resource.save()
      await ModuleModel.populate(resource, populations);

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
        await ModuleModel.populate(resource, populations);

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
**/

const cancel = async (req, res) => {

  let id = req.body.id;
  let userbooking = await UserBooking.findOne({_id:id}).populate('property').populate({path:'room.room',populate:{path:'room_type'}});
  let hotel_name = userbooking.property.name;
  let guest_name = userbooking.guestinfo.title+". "+userbooking.guestinfo.first_name+" "+userbooking.guestinfo.last_name;
  let book_id = userbooking.book_id;
  let date = userbooking.checkin_date+" "+userbooking.checkin_time;
  let user_mobile = userbooking.guestinfo.mobile;
  let booked_property = hotel_name;
  let booked_property_address = userbooking.property.contactinfo.location;
  let booked_property_email = userbooking.property.contactinfo.email;
  let booked_property_phone = userbooking.property.contactinfo.mobile;
  let booked_room_types = "";
  let rooms = userbooking.room;
  for(var i=0;i<rooms.length;i++){
    booked_room_types += rooms[i].room.room_type.name;
  }
  if(booked_room_types){
    booked_room_types = booked_room_types.replace(/,\s*$/, "");
  }
  date = moment(date).format('dddd YYYY-MM-DD HH:mm');
  let booked_date = date;
  if(userbooking){
    userbooking.cancel_request = 1;
    const STAY_DURATION = userbooking.stayDuration;
    // Capitalize first letter
    let BOOKING_TYPE = userbooking.bookingType
      ? userbooking.bookingType.charAt(0).toUpperCase() + userbooking.bookingType.substring(1)
      : ''
    ;
    await userbooking.save();
    let html_body = fs.readFileSync('public/order_cancel_request.html', 'utf8');
    
    html_body = html_body.replace(/{{USERNAME}}/g, guest_name);
    html_body = html_body.replace(/{{HOTEL_NAME}}/g, hotel_name);
    html_body = html_body.replace(/{{BOOKID}}/g, book_id);
    html_body = html_body.replace(/{{DATE}}/g, date);
    html_body = html_body.replace(/{{USER_MOBILE}}/g, user_mobile);
    html_body = html_body.replace(/{{BOOKED_PROPERTY}}/g, booked_property);
    html_body = html_body.replace(/{{BOOKED_PROPERTY_ADDRESS}}/g, booked_property_address);
    html_body = html_body.replace(/{{BOOKED_PROPERTY_PHONE}}/g, booked_property_phone);
    html_body = html_body.replace(/{{STAY_DURATION}}/g, STAY_DURATION);
    html_body = html_body.replace(/{{BOOKING_TYPE}}/g,  BOOKING_TYPE);
    html_body = html_body.replace(/{{BOOKED_ROOM_TYPES}}/g, booked_room_types);
    html_body = html_body.replace(/{{BOOKED_DATE}}/g, booked_date);
    html_body = html_body.replace(/{{HOTEL_CONTACT_NUMBER}}/g, booked_property_phone);
    html_body = html_body.replace(/{{HOTEL_EMAIL}}/g, booked_property_email);

    // TODO: Enable Emails for production
    msg = {
      // NEW
      // to: config.website_cancellation_email,
      // bcc: [{ email: config.website_admin_bcc_email}],

      // TESTING
      to: 'rahul.vagadiya+shcancellation@gmail.com',
      // bcc: [{ email: config.website_admin_bcc_email}],
      from: {
        email: config.website_admin_from_email,
        name: config.fromname
      },
      subject: "STAYHOPPER: Booking cancellation request",
      text:
        "Booking cancellation request",
      html: html_body
    };

    sgMail.send(msg).catch(e => console.log('error in mailing SH for cancellation', e));

    return res.status(200).json({message:'Booking Cancellation Request sent successfully!'})
  } else {
    return res.status(500).json({message:'Could not cancel booking'})
  }
}

const remove = async (req, res) => {
  try {
    let id = req.params.id;
    let userbooking = await UserBooking.findOne({ _id: id })
      .populate("property")
      .populate({ path: "room.room", populate: { path: "room_type" } });
    let hotel_name = userbooking.property.name;
    let guest_name = `${userbooking.guestinfo.title}. ${userbooking.guestinfo.first_name} ${userbooking.guestinfo.last_name}`;
    let book_id = userbooking.book_id;
    let date = userbooking.checkin_date + " " + userbooking.checkin_time;
    let booked_property_address = userbooking.property.contactinfo.location;
    let booked_property_phone = userbooking.property.contactinfo.mobile;
    let booked_room_types = "";
    let rooms = userbooking.room;
    let guest_email = userbooking.guestinfo.email;
    for (var i = 0; i < rooms.length; i++) {
      booked_room_types += rooms[i].room.room_type.name;
    }
    if (booked_room_types) {
      booked_room_types = booked_room_types.replace(/,\s*$/, "");
    }
    date = moment(date).format("dddd YYYY-MM-DD hh:mm A");

    if (userbooking) {
      await Booking.update(
        {},
        { $pull: { slots: { userbooking: id } } },
        { multi: true }
      );
      await BookLog.deleteMany({ userbooking: id });
      userbooking.cancel_approval = 1;
      const STAY_DURATION = userbooking.stayDuration;

      // Capitalize first letter
      const BOOKING_TYPE = userbooking.bookingType
        ? userbooking.bookingType.charAt(0).toUpperCase() + userbooking.bookingType.substring(1)
        : ''
      ;

      await userbooking.save();
      
      let html_body = fs.readFileSync('public/order_cancelled.html', 'utf8');

      html_body = html_body.replace(/{{USER_NAME}}/g, guest_name);
      html_body = html_body.replace(/{{HOTEL_NAME}}/g, hotel_name);
      html_body = html_body.replace(/{{BOOK_ID}}/g, book_id);
      html_body = html_body.replace(/{{DATE}}/g, date);
      html_body = html_body.replace(/{{ADDRESS}}/g, booked_property_address);
      html_body = html_body.replace(/{{HOTEL_PHONE}}/g, booked_property_phone);
      html_body = html_body.replace(/{{STAY_DURATION}}/g, STAY_DURATION);
      html_body = html_body.replace(/{{BOOKING_TYPE}}/g, BOOKING_TYPE);
      html_body = html_body.replace(/{{ROOM_TYPE}}/g, booked_room_types);
      html_body = html_body.replace(/{{DATE}}/g, date);

      // TODO: Enable Emails for production
      msg = {
        // NEW
        // to: guest_email,
        // bcc: [{ email: config.website_admin_bcc_email}],//config.website_admin_bcc_email

        // TESTING
        to: guest_email,
        bcc: [{ email: 'rahul.vagadiya+guest@gmail.com'}],
        from: {
          email: config.website_admin_from_email,
          name: config.fromname
        },
        subject: "STAYHOPPER: Booking cancellation request",
        text:
          "Booking cancellation request",
        html: html_body
      };

      sgMail.send(msg);

      return res.status(200).json({
        message: "Booking deleted successfully!"
      });
    } else {
      return res.status(500).json({
        message: "Booking could not be deleted!"
      });
    }
  } catch (e) {
    console.log('e', e);
    return res.status(500).json({
      message: "Booking could not be deleted!"
    });
  }
}

const rejectCancellation = async (req, res) => {
  try {
    let id = req.params.id;
    //fetch mail details
    let userbooking = await UserBooking.findOne({_id:id}).populate('property').populate({path:'room.room',populate:{path:'room_type'}});
    let hotel_name = userbooking.property.name;
    let guest_name = userbooking.guestinfo.title+". "+userbooking.guestinfo.first_name+" "+userbooking.guestinfo.last_name;
    let book_id = userbooking.book_id;
    let date = userbooking.checkin_date+" "+userbooking.checkin_time;
    let user_mobile = userbooking.guestinfo.mobile;
    let booked_property = hotel_name;
    let booked_property_address = userbooking.property.contactinfo.location;
    let booked_property_phone = userbooking.property.contactinfo.mobile;
    let booked_room_types = "";
    let rooms = userbooking.room;
    for(var i=0;i<rooms.length;i++){
      booked_room_types += rooms[i].room.room_type.name;
    }
    if(booked_room_types){
      booked_room_types = booked_room_types.replace(/,\s*$/, "");
    }
    date = moment(date).format('dddd YYYY-MM-DD hh:mm A');
    let booked_date = date;
    //end 

    if (userbooking) {
      const primaryReservationEmail = userbooking.property.primaryReservationEmail;
      const secondaryReservationEmails = userbooking.property.secondaryReservationEmails;
      userbooking.cancel_approval = 2;
      const STAY_DURATION = userbooking.stayDuration;

      // Capitalize first letter
      const BOOKING_TYPE = userbooking.bookingType
        ? userbooking.bookingType.charAt(0).toUpperCase() + userbooking.bookingType.substring(1)
        : ''
      ;

      await userbooking.save();

      let html_body = fs.readFileSync('public/order_cancel_request_rejected.html', 'utf8');

      html_body = html_body.replace(/{{GUEST_NAME}}/g, guest_name);
      html_body = html_body.replace(/{{HOTEL_NAME}}/g, hotel_name);
      html_body = html_body.replace(/{{BOOK_ID}}/g, book_id);
      html_body = html_body.replace(/{{DATE}}/g, date);
      html_body = html_body.replace(/{{GUEST_PHONE}}/g, user_mobile);
      html_body = html_body.replace(/{{PROPERTY_NAME}}/g, booked_property);
      html_body = html_body.replace(/{{PROPERTY_ADDRESS}}/g, booked_property_address);
      html_body = html_body.replace(/{{PROPERTY_PHONE}}/g, booked_property_phone);
      html_body = html_body.replace(/{{STAY_DURATION}}/g, STAY_DURATION);
      html_body = html_body.replace(/{{BOOKING_TYPE}}/g, BOOKING_TYPE);
      html_body = html_body.replace(/{{PROPERTY_ROOMS}}/g, booked_room_types);
      html_body = html_body.replace(/{{DATE}}/g, date);

      if (primaryReservationEmail) {
        const bcc = [];
        if (secondaryReservationEmails && secondaryReservationEmails.length) {
          secondaryReservationEmails
            .split(',')
            .forEach(em => {
              bcc.push({email: em.trim()})
            })
          ;
        }

        // TODO: Enable Emails for production
        msg = {
          // NEW
          // to: primaryReservationEmail,
          // bcc: [
          //   { email: config.website_admin_bcc_email },
          //   ...bcc
          // ],

          // TESTING
          to: 'rahul.vagadiya+shcancelreject@gmail.com',
          // bcc: [
          //   { email: config.website_admin_bcc_email },
          //   ...bcc
          // ],

          from: {
            email: config.website_admin_from_email,
            name: config.fromname
          },
          subject: "STAYHOPPER: booking cancellation request rejected!",
          text: "Your booking cancellation request has been rejected",
          html:html_body
        };
        sgMail.send(msg);
      }
    }

    return res.status(200).json({
      message: "Cancellation request rejected by admin"
    });
  } catch (e) {
    console.log('e', e);
    return res.status(500).json({
      message: "Cancellation request could not be rejected"
    });
  }
}

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), list);
router.post("/cancel", jwtMiddleware.administratorAuthenticationRequired, cancel);
router.post("/reject-cancellation/:id", jwtMiddleware.administratorAuthenticationRequired, rejectCancellation);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);
router.get("/:id/:status", jwtMiddleware.administratorAuthenticationRequired, single);
// router.post("/", jwtMiddleware.administratorAuthenticationRequired, create);
// router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, modify);
// router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);



module.exports = router;
