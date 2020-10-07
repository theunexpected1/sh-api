const db = require('../mongodb');
const bcrypt = require('bcrypt');

const countriesSchema = new db.Schema({
    country: String,
    isd_code: String,
    image: String,
    timezone: {
      type: String,
      default: 'Asia/Dubai'
    }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

countriesModel = db.model('countries', countriesSchema);
module.exports = countriesModel;