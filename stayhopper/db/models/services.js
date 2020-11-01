const db = require('../mongodb');
const bcrypt = require('bcrypt');

const servicesSchema = new db.Schema({
    name: {
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

servicesModel = db.model('services', servicesSchema);
module.exports = servicesModel;