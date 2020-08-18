const db = require("../mongodb");
const tradeLicenseSchema = new db.Schema({
  trade_licence_number: String,
  trade_licence_attachment: String,
  trade_licence_validity: String,
  passport_attachment: String
});
const paymentSchema = new db.Schema({
  name: String,
  country: {
    type: db.Schema.Types.ObjectId,
    ref: "countries"
  },
  bank: String,
  branch: String,
  account_no: String,
  ifsc: String,
  currency: {
    type: db.Schema.Types.ObjectId,
    ref: "currencies"
  },
  tax: {
    type: String
  },
  excluding_vat:{
    type: String
  },
  tourism_fee:{
    type: String
  },
  muncipality_fee:{
    type: String
  },
  service_charge:{
    type: String
  }
});
const adminSchema = new db.Schema({
  contact_person: {
    type: String,
    required: [true, "Contact Person is required"]
  },
  legal_name: {
    type: String,
    // required: [true, "Legal Name is required"]
  },
  country: {
    type: db.Schema.Types.ObjectId,
    ref: "countries",
    // required: [true, "Country is required"]
  },
  city: {
    type: db.Schema.Types.ObjectId,
    ref: "cities",
    // required: [true, "City is required"]
  },
  address_1: {
    type: String
  },
  address_2: {
    type: String
  },
  location: {
    type: String
  },
  latlng: {
    type: [Number]
  },
  zip: {
    type: String
  },
  email: {
    type: String,
    required: [true, "Contact Email is required"]
  },
  mobile: {
    type: String
  },
  land_phone: {
    type: String
  },
  alt_land_phone: {
    type: [String]
  }
});

const nearBySchema = new db.Schema({
  name: {
    type: String,
    required: [true, "Nearby location is required"]
  },
  image: {
    type: String,
    default: null
  }
})

const chargesSchema = new db.Schema({
  name: String,
  id: String,
  chargeType: String,
  value: Number
}, {_id: false})

var uniqueValidator = require("mongoose-unique-validator");
const AllAdministratorsSchema = {
  type: db.Schema.Types.ObjectId,
  ref: "administrators"
};

const propertySchema = new db.Schema({
  company: {
    type: db.Schema.Types.ObjectId,
    ref: "hotel_admins",
    // required: [false, "Contact Person is required"]
  },
  administrator: {
    type: db.Schema.Types.ObjectId,
    ref: "administrators",
    required: [true, "Administrator is required"]
  },
  allAdministrators: [AllAdministratorsSchema],
  name: {
    type: String,
    required: [true, "Property Name is required"]
  },
  type: {
    type: db.Schema.Types.ObjectId,
    ref: "property_types",
    // required: [true, "Property Type is required"]
  },
  rating: {
    type: db.Schema.Types.ObjectId,
    ref: "property_ratings",
    // required: [true, "Property Rating is required"]
  },
  description: {
    type: String
  },
  timeslots: {
    type: [Number]
  },
  trade_licence: tradeLicenseSchema,
  rooms: [{ type: db.Schema.Types.ObjectId, ref: "rooms" }],
  policies: [{ type: db.Schema.Types.ObjectId, ref: "privacy_policies" }],
  terms: [{ type: db.Schema.Types.ObjectId, ref: "terms_conditions" }],
  images: [String],
  featured: [String],
  contactinfo: adminSchema,
  currency: {
    type: db.Schema.Types.ObjectId,
    ref: "currencies",
    required: [true, "Currency is required"]
  },
  primaryReservationEmail: {
    type: String,
    required: true
  },
  secondaryReservationEmails: {
    type: String,
    default: ''
  },
  weekends: {
    type: [String],
    enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  },
  approved: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: false
  },
  services: [{ type: db.Schema.Types.ObjectId, ref: "services" }],
  payment: paymentSchema,
  charges: [chargesSchema],
  nearby : [nearBySchema],
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [Number]
   },
  user_rating: Number,
  legal_name: {
    type: String,
    // required: [true, "Legal Name is required"]
  },
  status: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    enum: ['Website', 'Extranet'],
    default: 'Extranet'
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});
// propertySchema.index({ location: "2dsphere" });
propertySchema.query.withinMiles = function(coords, miles) {
  return this.find({
    "contactinfo.latlng": {
      $geoWithin: {
        $center: [coords, miles / 3963.2]
      }
    }
  });
};


propertySchema.plugin(uniqueValidator, { message: "{PATH} to be unique." });

hoteladminModel = db.model("properties", propertySchema);
module.exports = hoteladminModel;
