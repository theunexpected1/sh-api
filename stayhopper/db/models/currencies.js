const db = require('../mongodb');

const currencySchema = new db.Schema({
    name: {
        type: String,
    },
    code: {
        type: String
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

termsModel = db.model('currencies', currencySchema);
module.exports = termsModel;