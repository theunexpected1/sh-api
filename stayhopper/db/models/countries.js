const db = require('../mongodb');
const bcrypt = require('bcrypt');

const countriesSchema = new db.Schema({
    country: String,
    isd_code:  String,
    image: String
});

countriesModel = db.model('countries', countriesSchema);
module.exports = countriesModel;