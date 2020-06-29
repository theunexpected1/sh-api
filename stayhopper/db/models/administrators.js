const db = require('../mongodb');
const bcrypt = require('bcrypt');

var uniqueValidator = require('mongoose-unique-validator');

const AdministratorSchema = new db.Schema({
  name: {
    type: String,
    required: [true, 'Name is required']
  },
  email: {
    type: String,
    unique: true,
    required: [true, 'Email Address is required'],
    select: false
  },
  status: {
    type: Boolean,
    required: [true, 'Status is required']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false
  },
  role: {
    type: String,
    enum: ['ADMIN', 'HOTEL_ADMIN'],
    default: 'HOTEL_ADMIN'
  },
  activationCode: {
    type: String
  },
  contact_person: {
    type: String,
    required: [true, 'Contact Person is required']
  },
  legal_name: {
    type: String,
    unique: true,
    required: [true, 'Legal Name is required']
  },
  country: {
    type: db.Schema.Types.ObjectId,
    ref:'countries',
    required: [true, 'Country is required']
  },
  city: {
    type: db.Schema.Types.ObjectId,
    ref:'cities',
    required: [true, 'City is required']
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
  mobile: {
    type: String
  },
  land_phone: {
    type: String
  },
  alt_land_phone: {
    type: [String]
  },
  rating : {
    type : Number
  },
  properties : [{
    type : db.Schema.Types.ObjectId,
    ref : "properties"
  }]
});

AdministratorSchema.plugin(uniqueValidator, { message: '{PATH} to be unique.' });

// checking if password is valid
AdministratorSchema.methods.validPassword = async function(password) {
  return await bcrypt.compare(password, this.password)
};

AdministratorSchema.pre('save', function (next) {
  var admin = this;
  bcrypt.hash(admin.password, 10, function (err, hash) {
    if (err) {
      return next(err);
    }
    admin.password = hash;
    next();
  })
});

AdministratorModel = db.model('administrators', AdministratorSchema);
module.exports = AdministratorModel;