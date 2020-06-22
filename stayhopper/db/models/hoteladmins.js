const db = require('../mongodb');
const bcrypt = require('bcrypt');

var uniqueValidator = require('mongoose-unique-validator');
const hoteladminSchema = new db.Schema({
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
    },
    password: {
        type: String
    },
    rating : {
        type : Number
    },
    properties : [{
        type : db.Schema.Types.ObjectId,
        ref : "properties"
    }],
    status : {
        type : Boolean,
        default : true
    }
});
hoteladminSchema.pre('save', function (next) {
    var admin = this;
    if(admin.password){
        bcrypt.hash(admin.password, 10, function (err, hash) {
            if (err) {
                return next(err);
            }
            admin.password = hash;
        })
    }
    next();
});

hoteladminModel = db.model('hotel_admins', hoteladminSchema);
module.exports = hoteladminModel;