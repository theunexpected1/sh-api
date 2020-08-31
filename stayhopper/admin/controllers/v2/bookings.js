const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const path = require("path");
const paginate = require("express-paginate");
const config = require("config");
const moment = require("moment");

const db = require("../../../db/mongodb");
const UserBookings = require("../../../db/models/userbookings");
const CompletedBookings = require("../../../db/models/completedbookings");
const Property = require("../../../db/models/properties");
const User = require("../../../db/models/users");
const jwtMiddleware = require("../../../middleware/jwt");


// START: Customize
const ModuleTitle = "Bookings";
// We'll switch between UserBookings or CompletedBookings
const selections = '';
const populations = [
  {
    path: "user"
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

  // Filter: User's Invoices - Restrict to logged in user viewing their own Invoices if they dont have access to all
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

    uniqueOrQuery.push({'propertyInfo.id': {
      $in: propertiesWithAccess.map(p => p._id)
    }});

    where['$and'].push({$or: uniqueOrQuery});
  }

  // Filter: Property
  if (property) {
    where['propertyInfo.id'] = property;
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

      let resources = await ModuleModel.find(where).sort(sort).limit(100).populate(populations).exec()
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
          ? Property.find({}).sort({name: 1})
          : Property.find({
            $and: [
              {administrator: user._id},
              {allAdministrators: {
                $in: [user._id]
              }}
            ]
          }).sort({name: 1})
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

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), list);
router.get("/:id/:status", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), single);
// router.post("/", jwtMiddleware.administratorAuthenticationRequired, create);
// router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, modify);
// router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);

module.exports = router;
