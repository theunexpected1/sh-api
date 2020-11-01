const db = require('../mongodb');
const bcrypt = require('bcrypt');

const roomTypesSchema = new db.Schema({
    name: {
        type: String,
    },
    image: {
        type: String,
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

roomTypesModel = db.model('room_types', roomTypesSchema);
module.exports = roomTypesModel;