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
    required: [true, "Legal Name is required"]
  },
  country: {
    type: db.Schema.Types.ObjectId,
    ref: "countries",
    required: [true, "Country is required"]
  },
  city: {
    type: db.Schema.Types.ObjectId,
    ref: "cities",
    required: [true, "City is required"]
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
    type: String
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
var uniqueValidator = require("mongoose-unique-validator");
const propertySchema = new db.Schema({
  company: {
    type: db.Schema.Types.ObjectId,
    ref: "hotel_admins",
    required: [true, "Contact Person is required"]
  },
  name: {
    type: String,
    required: [true, "Property Name is required"]
  },
  type: {
    type: db.Schema.Types.ObjectId,
    ref: "property_types",
    required: [true, "Property Type is required"]
  },
  rating: {
    type: db.Schema.Types.ObjectId,
    ref: "property_ratings",
    required: [true, "Property Rating is required"]
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
  approved: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: false
  },
  payment: paymentSchema,
  nearby : [nearBySchema],
  location: {
    type: { type: String },
    coordinates: [Number]
   },
  user_rating: Number,
  legal_name: {
    type: String,
    required: [true, "Legal Name is required"]
  },
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
