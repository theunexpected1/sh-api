const db = require('../mongodb');
const bcrypt = require('bcrypt');

const propertyRatingsSchema = new db.Schema({
    name: {
        type: String,
    },
    value: {
        type: Number
    }
});

propertyRatingsModel = db.model('property_ratings', propertyRatingsSchema);
module.exports = propertyRatingsModel;