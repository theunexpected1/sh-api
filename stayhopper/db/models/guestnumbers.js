const db = require('../mongodb');
const bcrypt = require('bcrypt');

const guestNumbersSchema = new db.Schema({
    name: {
        type: String
    },

    // adult
    value: {
        type: Number
    },

    // child
    childrenValue: {
        type: Number
    },

    image: {
        type: String
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

guestNumbersModel = db.model('guest_numbers', guestNumbersSchema);
module.exports = guestNumbersModel;