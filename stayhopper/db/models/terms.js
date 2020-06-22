const db = require('../mongodb');
const bcrypt = require('bcrypt');

const termsSchema = new db.Schema({
    value: {
        type: String
    },
    image: {
        type: String
    }
});

termsModel = db.model('terms_conditions', termsSchema);
module.exports = termsModel;