const db = require('../mongodb');
const bcrypt = require('bcrypt');

const guestNumbersSchema = new db.Schema({
    name: {
        type: String
    },
    value:{
        type: Number
    },
    image: {
        type: String
    }
});

guestNumbersModel = db.model('guest_numbers', guestNumbersSchema);
module.exports = guestNumbersModel;