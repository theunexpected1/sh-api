const db = require('../mongodb');
const bcrypt = require('bcrypt');

const propertyTypesSchema = new db.Schema({
    name: {
        type: String,
    },
    image:{
        type: String
    }
});

propertyTypesModel = db.model('property_types', propertyTypesSchema);
module.exports = propertyTypesModel;