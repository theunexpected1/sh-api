const db = require('../mongodb');
const test1Schema = new db.Schema({
    property_name: {
        type: String,
    },
    location: {
        type: String,
    },
    slot: {
        type: String,
    },
    review: {
        type: String,
    },
    hotel_star: {
        type: String,
    }
});

test1Model = db.model('test1', test1Schema);
module.exports = test1Model;