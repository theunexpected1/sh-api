const db = require('../mongodb');
const bcrypt = require('bcrypt');

const bedTypesSchema = new db.Schema({
    name: {
        type: String,
    },
    image: {
        type: String,
    }
});

bedTypesModel = db.model('bed_types', bedTypesSchema);
module.exports = bedTypesModel;