const db = require('../mongodb');
const bcrypt = require('bcrypt');

var uniqueValidator = require('mongoose-unique-validator');

const adminSchema = new db.Schema({
    name: {
        type: String,
        required: [true, 'Name is required']
    },
    email: {
        type: String,
        unique: true,
        required: [true, 'Email Address is required']
    },
    status: {
        type: Boolean,
        required: [true, 'Status is required']
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    }
});

adminSchema.plugin(uniqueValidator, { message: '{PATH} to be unique.' });

adminSchema.pre('save', function (next) {
    var admin = this;
    bcrypt.hash(admin.password, 10, function (err, hash) {
        if (err) {
            return next(err);
        }
        admin.password = hash;
        next();
    })
});

adminModel = db.model('admins', adminSchema);
module.exports = adminModel;