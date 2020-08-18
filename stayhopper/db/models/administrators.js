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
    required: [true, 'Status is required'],
    default: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false
  },
  role: {
    type: db.Schema.Types.ObjectId,
    ref: 'roles'
  },
  activationCode: {
    type: String,
    select: false
  },
  autoLoginCode: {
    type: String,
    select: false
  },
  contact_person: {
    type: String
  },
  legal_name: {
    type: String,
    // required: [true, 'Legal Name is required']
  },
  country: {
    type: db.Schema.Types.ObjectId,
    ref:'countries',
    // required: [true, 'Country is required']
  },
  city: {
    type: db.Schema.Types.ObjectId,
    ref:'cities',
    // required: [true, 'City is required']
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
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

AdministratorSchema.plugin(uniqueValidator, { message: '{PATH} to be unique.' });

// checking if password is valid
AdministratorSchema.methods.validPassword = async function(password) {
  return await bcrypt.compare(password, this.password)
};

AdministratorSchema.pre('save', function (next) {
  // var admin = this;
  // // Executed only for change-password as we call admin.save() there
  // // In case of amdinistrator -> modify, we do findOneAndUpdate(), so the pre save hooks dont trigger
  // // If we wish to harmonize this, the password hashing should be part of change-password call and not as a hook
  // if (admin.password) {
  //   bcrypt.hash(admin.password, 10, function (err, hash) {
  //     if (err) {
  //       return next(err);
  //     }
  //     admin.password = hash;
  //     next();
  //   })
  // } else {
  //   next();
  // }
  next();
});

AdministratorModel = db.model('administrators', AdministratorSchema);
module.exports = AdministratorModel;