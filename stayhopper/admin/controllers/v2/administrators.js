const mongoose = require('mongoose');
const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
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

const Property = require("../../../db/models/properties");
const Currency = require("../../../db/models/currencies");
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

const service = {
  sendWelcomeEmailToAdmin: async administratorId => {
    try {
      let extranet_url = config.extranet_url;
      const administrator = await Administrator.findOne({_id: administratorId}).select('+email').select('+password');
      if (administrator) {
        const password = generator.generate({
          length: 10,
          numbers: true
        });
        administrator.password = await bcrypt.hashSync(password, 10);
        await administrator.save();

        let html_body = await readFile(currentDirPath + '/../../../emails/welcome.html', 'utf8')
        html_body = html_body.replace('{{USERNAME}}', administrator.email);
        html_body = html_body.replace('{{PASSWORD}}', password);
        html_body = html_body.replace('{{URL}}', extranet_url);
        msg = {
          to: administrator.email,
          bcc: [{ email: config.website_admin_bcc_email }],
          from: {
            email: config.website_admin_from_email,
            name: config.fromname
          },
          subject: "STAYHOPPER: Account has been created!",
          text: "Congratulations! Your account has been created",
          html: html_body
        };

        sgMail.send(msg);
        return {
          status: 200
        };
      } else {
        return {
          status: 404
        };
      }
    } catch (e) {
      console.log('e', e);
      return {
        status: 500
      };
    }
  },

  createOnboardingProperty: async resourceData => {
    try {
      const administrator = await Administrator.findOne({
        status: true,
        email: resourceData.email
      });

      if (administrator) {
        const currencyAED = await Currency.findOne({name: new RegExp('dirham', 'i')});
        const propertyData = {
          name: resourceData.propertyName,
          location: resourceData.location,
          primaryReservationEmail: resourceData.email,
          administrator,
          allAdministrators: [administrator],
          currency: currencyAED ? currencyAED._id : '',
          contactinfo: {
            contact_person: resourceData.name,
            email: resourceData.email,
          },
          status: false,
          source: 'Website',
        }
        const property = new Property(propertyData);
        await property.save();
        return {
          status: 200,
          property
        };
      } else {
        return {
          status: 404
        }
      }
    } catch (e) {
      console.log('e 500', e);
      return {
        status: 500
      }
    }
  }
};

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
      // {address_1: new RegExp(keyword, 'i')},
      // {address_2: new RegExp(keyword, 'i')},
      // {location: new RegExp(keyword, 'i')}
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
      admin.properties = await Property
        .find(query)
        .select('_id')
        .select('name')
      ;
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
    // properties: properties,
    properties: [],
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

    if (!resourceData.city) {
      delete resourceData.city;
    }
    if (!resourceData.country) {
      delete resourceData.country;
    }

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
  const resourceData = req.body;
  const hasResourceAccess = permissions.indexOf(config.permissions.LIST_ADMINISTRATORS) > -1;
  if (!hasResourceAccess) {
    res.status(401).send({
      message: 'Sorry, you do not have access to this resource'
    }).end();
  }
  let where = {
    _id: req.params.id
  };

  if (!resourceData.city) {
    delete resourceData.city;
  }
  if (!resourceData.country) {
    delete resourceData.country;
  }

  try {
    // Return updated doc
    const resource = await Administrator
      .findOneAndUpdate(where, { $set: resourceData }, { new: true })
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
  const administratorId = req.params.id;
  try {
    const sendEmailResponse = await service.sendWelcomeEmailToAdmin(administratorId);
    if (sendEmailResponse && sendEmailResponse.status === 200) {
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

const onboarding = async (req, res) => {
  const resourceData = req.body;
  let resource;
  let sendEmail = true;

  try {
    const existingResource = await Administrator.findOne({email: resourceData.email}).select('+email');
    if (existingResource) {
      if (existingResource.status === false) {

        // Set Activation Code
        const code = Math.floor(Math.random() * 9000) + 1000;
        existingResource.activationCode = code;
        console.log('existing onboarding code', code);
        await existingResource.save();
        resource = existingResource;
      } else {
        sendEmail = false;
      }
    } else {
      // New admin

      // Set the code
      let role = '';
      const status = false;
      const code = Math.floor(Math.random() * 9000) + 1000;
      console.log('new onboarding code', code);
      resourceData.activationCode = code;

      // Set Hotel Admin Role
      let hotelAdminRole = await Role.findOne({permissions: {$in: ['LIST_OWN_PROPERTIES', 'LIST_INVOICES'], $nin: ['LIST_ALL_PROPERTIES']}});
      if (hotelAdminRole) {
        role = hotelAdminRole._id;
      }

      // Set password
      const passwordRaw = generator.generate({
        length: 10,
        numbers: true
      });
      const password = await bcrypt.hashSync(passwordRaw, 10);

      const administratorData = {name: resourceData.name,
        email: resourceData.email,
        password,
        activationCode: code,
        status
      };
      if (role) {
        administratorData.role = role;
      }

      resource = new Administrator(administratorData);
      await resource.save()
    }

    if (sendEmail) {

      let html_body = await readFile(currentDirPath + '/../../../emails/activate-hotel-admin.html', 'utf8')
      html_body = html_body.replace('{{ACTIVATION_CODE}}', resource.activationCode);
      msg = {
        to: resource.email,
        // bcc: [{ email: config.website_admin_bcc_email }],
        // from: config.website_admin_from_email,
        // fromname: config.fromname,
        from: {
          email: config.website_admin_from_email,
          name: config.fromname
        },
        subject: "STAYHOPPER: Activation Code",
        text: "Use this activation code to proceed",
        html: html_body
      };

      sgMail.send(msg);
      res.status(200).send({
        message: 'Email sent successfully!'
      }).end();

    } else {
      res.status(500).send({
        message: 'Sorry, the account with this email address is already active',
        messageCode: 'emailExists'
      }).end();
    }
  } catch (e) {
    console.log('e', e);
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation',
      error: e
    }).end();
  }
}

const onboardingVerification = async (req, res) => {
  try {
    const resourceData = req.body;
    const existingResource = await Administrator
      .findOne({
        status: false,
        email: resourceData.email
      })
      .populate('role')
      .select('+email')
      .select('+password')
      .select('+activationCode')
    ;

    if (existingResource) {
      if (
        !resourceData.activationCode ||
        existingResource.activationCode !== resourceData.activationCode
      ) {
        res.status(500).send({message: 'Sorry, the activation code is invalid'}).end();
      } else {
        // Activate account
        existingResource.status = true;
        existingResource.activationCode = '';
        const autoLoginCode = Math.floor(Math.random() * 9000) + 1000;
        existingResource.autoLoginCode = autoLoginCode;
        await existingResource.save();

        const sendEmailResponse = await service.sendWelcomeEmailToAdmin(existingResource._id);
        const createPropertyResponse = await service.createOnboardingProperty(resourceData);
        const property = createPropertyResponse && createPropertyResponse.status === 200
          ? createPropertyResponse.property
          : ''
        ;

        let extranetPropertyUrl = '';
        if (property && property._id) {
          const queryParams = `loginEmail=${encodeURIComponent(existingResource.email)}&loginToken=${autoLoginCode}`;
          extranetPropertyUrl = `${config.extranet_url}app/properties/${property._id}?${queryParams}`
        }
        console.log('extranetPropertyUrl', extranetPropertyUrl);
        res.status(200).send({
          message: 'Activated',
          extranetPropertyUrl
        }).end();
      }
    } else {
      res.status(500).send({
        message: 'Sorry, either the activation code is invalid, or the user is already activated'
      }).end();
    }
  } catch (e) {
    res.status(500).send({
      message: 'Sorry, there was an error in performing this operation'
    }).end();
  }
}

router.get("/", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), list);
router.get("/me", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), getMe);
router.get("/:id", jwtMiddleware.administratorAuthenticationRequired, paginate.middleware(10, 100), getById);
router.post("/", jwtMiddleware.administratorAuthenticationRequired, create);
router.put("/:id", jwtMiddleware.administratorAuthenticationRequired, modify);
router.delete("/:id", jwtMiddleware.administratorAuthenticationRequired, remove);
router.post('/send-welcome-email/:id', jwtMiddleware.administratorAuthenticationRequired, sendWelcomeEmail);
router.post('/onboarding', onboarding);
router.post('/onboarding/verify', onboardingVerification);

module.exports = router;
