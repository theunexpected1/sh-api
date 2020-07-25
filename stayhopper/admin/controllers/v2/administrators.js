const mongoose = require('mongoose');
// const db = require("../../../db/mongodb");
// const joi = require("joi");
// const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();
// const multer = require("multer");
// const pify = require("pify");
// const generator = require("generate-password");
const paginate = require("express-paginate");
const config = require("config");
const generator = require("generate-password");
const bcrypt = require('bcrypt');

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);

const fs = require('fs');
const util = require('util');
const path = require('path');
const readFile = util.promisify(fs.readFile);
const currentDirPath = path.resolve(__dirname);

// const Property = require("../../../db/models/properties");
// const Room = require("../../../db/models/rooms");
// const HotelAdmin = require("../../../db/models/hoteladmins");
// const User = require("../../../db/models/users");
// const PropertyTypes = require("../../../db/models/propertytypes");
// const PropertyRatings = require("../../../db/models/propertyratings");
// const Countries = require("../../../db/models/countries");
// const Currency = require("../../../db/models/currencies");
// const City = require("../../../db/models/cities");
// const UserBooking = require("../../../db/models/userbookings");
// const path = require("path");
// const _ = require("underscore");
// const { where } = require("underscore");

const Property = require("../../../db/models/properties");
const Role = require("../../../db/models/roles");
const Administrator = require("../../../db/models/administrators");
const jwtMiddleware = require("../../../middleware/jwt");

const resourcePopulations = [
  {
    path: "properties",
    populate: {
      path: "rooms type company rating"
    }
  },
  {
    path: "role"
  },
  {
    path: "country"
  },
  {
    path: "city"
  }
];

const propertiesPopulations = [
  {
    path: "rooms"
  },
  {
    path: "type"
  },
  {
    path: "company"
  },
  {
    path: "rating"
  }
]

const list = async (req, res) => {
  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_ADMINISTRATORS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }

  let active_page = 1;
  if(req.query.page){
    active_page = req.query.page;
  }
  let keyword = req.query.q;
  let role = req.query.role;
  let shouldGetProperties = req.query.getProperties;
  let rolesQuery = req.query.roles;

  let where = {};

  // // Filter: User's properties - Restrict to logged in user viewing their own properties if they dont have access to all
  // if (hasOwnPropertiesAccess && !hasAllPropertiesAccess) {
  //   where._id = {
  //     $in: user.properties
  //   }
  // }

  // Filter: Keywords
  if (keyword) {
    where['$or'] = [
      {name: new RegExp(keyword, 'i')},
      {email: new RegExp(keyword, 'i')},
      {legal_name: new RegExp(keyword, 'i')},
      {address_1: new RegExp(keyword, 'i')},
      {address_2: new RegExp(keyword, 'i')},
      {location: new RegExp(keyword, 'i')}
    ]
  }

  // Filter: Role
  if (role) {
    where.role = role
  }

  // Filter: multiple Roles
  if (rolesQuery) {
    where.role = {
      $in: rolesQuery.split(',')
    }
  }

  // Sorting
  let sort = { _id: 1 };
  if (req.query.order && req.query.orderBy) {
    sort = {};
    sort[req.query.orderBy] = req.query.order === 'asc' ? 1 : -1;
  }

  let [properties, roles, administrators, itemCount] = await Promise.all([
    hasResourceAccess ? Property.find() : Promise.resolve([]),
    hasResourceAccess ? Role.find() : Promise.resolve([]),
    Administrator
      .find(where)
      .select('+email')
      .sort(sort)
      .populate(resourcePopulations)
      .limit(req.query.limit)
      .skip(req.skip)
      .lean()
      .exec(),
    Administrator.countDocuments(where)
  ]);

  // Filter: Get Properties also?
  if (shouldGetProperties) {
    const getPropertiesForAdmin = async (admin) => {
      const query = {
        $or: [
          {
            allAdministrators: {
              $in: [admin._id]
            }
          },
          {
            administrator: admin._id
          }
        ]
      };
      admin.properties = await Property.find(query);;
      return admin;
    }
    administrators = await Promise.all(administrators.map(getPropertiesForAdmin))
  } else {
    administrators = administrators.map(a => {
      a.properties = [];
      return a;
    })
  }

  const pageCount = Math.ceil(itemCount / req.query.limit);
  let data = {
    list: administrators,
    properties: properties,
    roles: roles,
    itemCount: itemCount,
    pageCount: pageCount,
    pages: paginate.getArrayPages(req)(10, pageCount, req.query.page),
    active_page
  };
  res.status(200).send(data).end();
};

const getMe = async (req, res) => {
  let user = req.user;
  let {permissions} = user.role;
  let where = {
    _id: user._id
  };
  const administrator = await Administrator
    .findOne(where)
    .select('+email')
    .populate(resourcePopulations)
    .lean()
    .exec()
  ;
  res.status(200).send(administrator).end();
};

const getById = async (req, res) => {
  let user = req.user;
  let {permissions} = user.role;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_ADMINISTRATORS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }
  let where = {
    _id: req.params.id
  };

  try {
    const [resource] = await Promise.all([
      Administrator
        .findOne(where)
        .select('+email')
        .populate(resourcePopulations)
        .lean()
        .exec()
    ]);

    if (!resource) {
      return res.status(404).send({
        message: 'Resource does not exist'
      }).end();
    }

    const propertiesQuery = {
      $or: [
        {
          allAdministrators: {
            $in: [resource._id]
          }
        },
        {
          administrator: resource._id
        }
      ]
    };
    resource.properties = await Property.find(propertiesQuery).populate(propertiesPopulations);
    res.status(200).send(resource).end();
  } catch (e) {
    return res.status(500).send({
      message: 'Sorry, there was an error in performing this operation'
    }).end();
  }
};

const create = async (req, res) => {
  const user = req.user;
  const {permissions} = user.role;
  const resourceData = req.body;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_ADMINISTRATORS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }

  try {
    // Set password
    var password = generator.generate({
      length: 10,
      numbers: true
    });
    resourceData.password = await bcrypt.hashSync(password, 10);

    const resource = new Administrator(resourceData);
    await resource.save()

    if (resource) {
      res.status(200).send(resource).end();
    } else {
      res.status(500).send({
        message: 'Sorry, there was an error in performing this operation'
      }).end();
    }
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      error: e
    }).end();
  }
};


const modify = async (req, res) => {
  const user = req.user;
  const {permissions} = user.role;
  const updatedData = req.body;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_ADMINISTRATORS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }
  let where = {
    _id: req.params.id
  };

  try {
    // Return updated doc
    const resource = await Administrator
      .findOneAndUpdate(where, { $set: updatedData }, { new: true })
      .select('+email')
      .populate(resourcePopulations)
      .exec()
    ;

    if (resource) {
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
};

const remove = async (req, res) => {
  const user = req.user;
  const {permissions} = user.role;
  const updatedData = req.body;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_ADMINISTRATORS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }
  let where = {
    _id: req.params.id
  };

  try {
    // Return updated doc
    const resource = await Administrator
      .deleteOne(where)
      .exec()
    ;

    if (resource) {
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
};

const sendWelcomeEmail = async (req, res) => {
  let app_url = config.app_url;
  const administratorId = req.params.id;
  try {

    const administrator = await Administrator.findOne({_id: administratorId}).select('+email').select('+password');
    if (administrator) {
      const password = generator.generate({
        length: 10,
        numbers: true
      });
      console.log('password', password);
      console.log('before', administrator.password);
      administrator.password = await bcrypt.hashSync(password, 10);
      console.log('after', administrator.password);
      await administrator.save();

      let html_body = await readFile(currentDirPath + '/../../../emails/welcome.html', 'utf8')
      html_body = html_body.replace('{{USERNAME}}', administrator.email);
      html_body = html_body.replace('{{PASSWORD}}', password);
      html_body = html_body.replace('{{URL}}', app_url);     
      msg = {
        to: administrator.email,
        bcc: [{ email: config.website_admin_bcc_email }],
        from: config.website_admin_from_email,
        fromname: config.fromname,
        subject: "STAYHOPPER: Account has been created!",
        text: "Congratulations! Your account has been created",
        html: html_body
      };

      sgMail.send(msg);
      res.status(200).send({
        message: 'Email sent successfully!'
      }).end();
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

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), list);
router.get("/me", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), getMe);
router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 50), getById);
router.post("/", jwtMiddleware.administratorAuthenticationRequired, create);
router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, modify);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);
router.post('/send-welcome-email/:id', jwtMiddleware.administratorAuthenticationRequired, sendWelcomeEmail);


module.exports = router;
