const express = require("express");
const router = express.Router();
const multer = require("multer");
const pify = require("pify");
const path = require("path");
const paginate = require("express-paginate");
const config = require("config");
const moment = require("moment");

const db = require("../../../db/mongodb");
const Invoice = require("../../../db/models/invoices");
const Property = require("../../../db/models/properties");
const User = require("../../../db/models/users");
const CompletedBooking = require("../../../db/models/completedbookings");
const UserBooking = require("../../../db/models/userbookings");
const UserRating = require("../../../db/models/userratings");
const jwtMiddleware = require("../../../middleware/jwt");


// START: Customize
const ModuleTitle = "Invoices";
const ModuleModel = Invoice;
const selections = '';
const populations = [
  {
    path: "property"
  },
  {
    path: "currency"
  },
  {
    path: "userBookings"
  },
  {
    path: "completedBookings"
  }
];

const hasPermissions = (req, res) => {
  // Permissions
  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.SHOW_DASHBOARD) > -1;
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
  const hasFullDashboardAccess = permissions.indexOf(config.permissions.SHOW_FULL_DASHBOARD) > -1;
  const hasOwnDashboardAccess = permissions.indexOf(config.permissions.SHOW_OWN_DASHBOARD) > -1;

  const where = {};
  const property = req.query.property;
  const date = req.query.date;
  const status = req.query.status;

  // Filter: User's Invoices - Restrict to logged in user viewing their own Invoices if they dont have access to all
  if (hasOwnDashboardAccess && !hasFullDashboardAccess) {
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

    // Add staff roles here
    uniqueOrQuery.push({administrator: user._id});
    uniqueOrQuery.push({property: {
      $in: propertiesWithAccess.map(p => p._id)
    }});

    where['$and'].push({$or: uniqueOrQuery});
  }

  // Filter: Property
  if (property) {
    where.property = property;
  }

  // Filter: Date
  if (date) {
    console.log('date', date);
    where.invoiceForDate = moment(new Date(date)).startOf('month').format('YYYY-MM-DD');
  }

  // Filter: status
  if (status) {
    where.status = status;
  }

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
      if (req.query.orderBy === 'property') {
        const isAsc = req.query.order === 'asc';
        resources = resources
          .sort((a, b) => {
            if (a.property.name.trim().toLowerCase() < b.property.name.trim().toLowerCase()) { return isAsc ? -1 : 1; }
            if (a.property.name.trim().toLowerCase() > b.property.name.trim().toLowerCase()) { return isAsc ? 1 : -1; }
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
      const hasFullDashboardAccess = permissions.indexOf(config.permissions.SHOW_FULL_DASHBOARD) > -1;

      const [properties, list, itemCount] = await Promise.all([
        hasFullDashboardAccess ? Property.find({}).sort({name: 1}) : Promise.resolve([]),
        Promise.resolve(resources),
        ModuleModel.countDocuments(where)
      ]);

      const pageCount = Math.ceil(itemCount / req.query.limit);
      let data = {
        list: list,
        properties,
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

      // Forbid accessing other's invoice
      let user = req.user;
      let {permissions} = user.role;
      const hasFullDashboardAccess = permissions.indexOf(config.permissions.SHOW_FULL_DASHBOARD) > -1;
      const hasOwnDashboardAccess = permissions.indexOf(config.permissions.SHOW_OWN_DASHBOARD) > -1;
      if (hasOwnDashboardAccess && !hasFullDashboardAccess && resource.property) {
        const propertyAllAdministrators = resource.property.allAdministrators.map(a => a.toString());
        if (
          resource.property.administrator.toString() !== req.user._id.toString() &&
          propertyAllAdministrators.indexOf(req.user._id.toString()) === -1
        ) {
          res.status(401).send({
            message: 'Sorry, you do not have access to this resource'
          }).end();
        }
      }

      res.status(200).send(resource).end();
    } catch (e) {
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};

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

// router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), list);
// router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), single);
// router.post("/", jwtMiddleware.administratorAuthenticationRequired, create);
// router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, modify);
// router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);


const getProperties = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {

      // Further permissions
      let user = req.user;
      let {permissions} = user.role;
      const hasFullDashboardAccess = permissions.indexOf(config.permissions.SHOW_FULL_DASHBOARD) > -1;
      const hasOwnDashboardAccess = permissions.indexOf(config.permissions.SHOW_OWN_DASHBOARD) > -1;

      const whereTotal = {};
      const whereLive = {};
      const whereSourceWebsite = {};
      const whereSourceExtranet = {};

      // Filter: User's properties - Restrict to logged in user viewing their own properties if they dont have access to all
      if (hasOwnDashboardAccess && !hasFullDashboardAccess) {
        whereTotal['$and'] = whereTotal['$and'] || [];
        whereLive['$and'] = whereLive['$and'] || [];
        const uniqueOrQuery = [];

        // Add staff roles here
        uniqueOrQuery.push({administrator: user._id});
        uniqueOrQuery.push({allAdministrators: {
          $in: [user._id]
        }});

        whereTotal['$and'].push({$or: uniqueOrQuery});
        whereLive['$and'].push({$or: uniqueOrQuery});
      }

      whereLive.approved = true;
      whereLive.published = true;
      whereSourceWebsite.source = 'Website';
      whereSourceExtranet.$or = [{
        source: ''
      }, {
          source: 'Extranet'
      }, {
          source: {$exists: false}
      }];

      const count = await Property.countDocuments(whereTotal);
      const countLive = await Property.countDocuments(whereLive);
      const countSourceExtranet = await Property.countDocuments(whereSourceExtranet);
      const countSourceWebsite = await Property.countDocuments(whereSourceWebsite);

      res.status(200).send({
        count,
        countLive,
        countSourceExtranet,
        countSourceWebsite
      }).end();
    } catch (e) {
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};


const getBookings = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {

      // Further permissions
      let user = req.user;
      let {permissions} = user.role;
      const hasFullDashboardAccess = permissions.indexOf(config.permissions.SHOW_FULL_DASHBOARD) > -1;
      const hasOwnDashboardAccess = permissions.indexOf(config.permissions.SHOW_OWN_DASHBOARD) > -1;

      const where = {};

      const whereActive = {};
      const whereCompleted = {};

      // Filter: User's Bookings - Restrict to logged in user viewing their own Bookings if they dont have access to all
      if (hasOwnDashboardAccess && !hasFullDashboardAccess) {
        whereCompleted['$and'] = whereCompleted['$and'] || [];
        whereActive['$and'] = whereActive['$and'] || [];
        const uniqueCompletedOrQuery = [];
        const uniqueActiveOrQuery = [];

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

        uniqueCompletedOrQuery.push({'propertyInfo.id': {
          $in: propertiesWithAccess.map(p => p._id)
        }});
        
        uniqueActiveOrQuery.push({'proeprty': {
          $in: propertiesWithAccess.map(p => p._id)
        }});

        whereCompleted['$and'].push({$or: uniqueCompletedOrQuery});
        whereActive['$and'].push({$or: uniqueActiveOrQuery});
      }

      const countActive = await UserBooking.countDocuments(whereActive);
      const countCompleted = await CompletedBooking.countDocuments(whereCompleted);

      res.status(200).send({countActive, countCompleted}).end();
    } catch (e) {
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};


const getUserRatings = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {

      // Further permissions
      let user = req.user;
      let {permissions} = user.role;
      const hasFullDashboardAccess = permissions.indexOf(config.permissions.SHOW_FULL_DASHBOARD) > -1;
      const hasOwnDashboardAccess = permissions.indexOf(config.permissions.SHOW_OWN_DASHBOARD) > -1;

      const whereUnapproved = {};
      const whereApproved = {};

      // Filter: User's Bookings - Restrict to logged in user viewing their own Bookings if they dont have access to all
      if (hasOwnDashboardAccess && !hasFullDashboardAccess) {
        whereUnapproved['$and'] = whereUnapproved['$and'] || [];
        whereApproved['$and'] = whereApproved['$and'] || [];
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

        uniqueOrQuery.push({property: {
          $in: propertiesWithAccess.map(p => p._id)
        }});

        whereUnapproved['$and'].push({$or: uniqueOrQuery});
        whereApproved['$and'].push({$or: uniqueOrQuery});
      }

      whereUnapproved.approved = false;
      whereApproved.approved = true;

      const countUnapproved = await UserRating.countDocuments(whereUnapproved);
      const countApproved = await UserRating.countDocuments(whereApproved);

      res.status(200).send({countUnapproved, countApproved}).end();
    } catch (e) {
      console.log('e', e);
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};

const getUsers = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {
      // Further permissions
      let user = req.user;
      let {permissions} = user.role;
      const hasFullDashboardAccess = permissions.indexOf(config.permissions.SHOW_FULL_DASHBOARD) > -1;
      if (hasFullDashboardAccess) {
        const count = await User.countDocuments();
        const latest = await User.find().sort({createdAt: -1, _id: -1}).limit(5);
        res.status(200).send({count, latest}).end();
      } else {
        res.status(401).send({
          message: 'Sorry, you do not have access to this resource'
        }).end();
      }
    } catch (e) {
      console.log('e', e);
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};

const getInvoices = async (req, res) => {
  if (hasPermissions(req, res)) {
    try {

      // Further permissions
      let user = req.user;
      let {permissions} = user.role;
      const hasFullDashboardAccess = permissions.indexOf(config.permissions.SHOW_FULL_DASHBOARD) > -1;
      const hasOwnDashboardAccess = permissions.indexOf(config.permissions.SHOW_OWN_DASHBOARD) > -1;

      const where = {};

      // Filter: User's Invoices - Restrict to logged in user viewing their own Invoices if they dont have access to all
      if (hasOwnDashboardAccess && !hasFullDashboardAccess) {
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

        // Add staff roles here
        uniqueOrQuery.push({administrator: user._id});
        uniqueOrQuery.push({property: {
          $in: propertiesWithAccess.map(p => p._id)
        }});

        where['$and'].push({$or: uniqueOrQuery});
      }

      where.status = 'pending';

      // Unpaid invoices
      const count = await Invoice.countDocuments(where);

      res.status(200).send({count}).end();
    } catch (e) {
      console.log('e', e);
      return res.status(500).send({
        message: 'Sorry, there was an error in performing this action'
      }).end();
    }
  }
};
router.get("/properties", jwtMiddleware.administratorAuthenticationRequired, getProperties);
router.get("/bookings", jwtMiddleware.administratorAuthenticationRequired, getBookings);
router.get("/user-ratings", jwtMiddleware.administratorAuthenticationRequired, getUserRatings);
router.get("/users", jwtMiddleware.administratorAuthenticationRequired, getUsers);
router.get("/invoices", jwtMiddleware.administratorAuthenticationRequired, getInvoices);

module.exports = router;
