const db = require('../mongodb');
const bcrypt = require('bcrypt');
const Country = require('./countries');
const City = require('./cities');

var uniqueValidator = require("mongoose-unique-validator");
var validateEmail = function(email) {
    var re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return re.test(email)
};

const usersSchema = new db.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
    },
    last_name: {
        type: String
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        required: [true, 'Email is required'],
        validate: [validateEmail, 'Please fill a valid email address'],
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    mobile: {
        type: String,
        trim: true
    },
    city:{
        type: String
    },
    country:{
        type: String
    },
    dateOfBirth: {
        type: String
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        default: 'other'
    },
    city_id:{
        type: db.Schema.Types.ObjectId,
        ref: "cities"
    },
    country_id:{
        type: db.Schema.Types.ObjectId,
        ref: "countries"
    },
    image:{
        type: String
    },
    password:{
        type: String,
        required: [true, 'Password is required'],
    },
    favourites: [{ type: db.Schema.Types.ObjectId, ref: "properties" }],
    status: {
        type: Number,
        default: 1
    },
    promocodes: [String],
    device_type:String,
    device_token:String
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

usersSchema.plugin(uniqueValidator, { message: "{PATH} to be unique." });
usersSchema.methods.validPassword = async function(password) {
    return await bcrypt.compare(password, this.password)
};

// usersSchema.pre('save', async function (next) {
//     var user = this;
//     let countries = await Country.find({});
//     let cities = await City.find({});
//     if (user.country || user.city) {
//         // Save Country ID
//         if (user.country) {
//             const matchingCountry = countries.find(c => c.country.toString().toLowerCase() === user.country.toLowerCase());
//             if (matchingCountry) {
//                 user.country_id = matchingCountry._id;
//             }
//         }

//         // Save City ID
//         if (user.city) {
//             const matchingCity = cities.find(c => c.name.toString().toLowerCase() === user.city.toLowerCase());
//             if (matchingCity) {
//                 user.city_id = matchingCity._id;
//             }
//         }
//         next();
//     } else {
//         next();
//     }
// });

usersModel = db.model('users', usersSchema);
module.exports = usersModel;