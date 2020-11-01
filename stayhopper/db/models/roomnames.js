const db = require('../mongodb');
const bcrypt = require('bcrypt');

const roomNamesSchema = new db.Schema({
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

roomNamesModel = db.model('room_names', roomNamesSchema);
module.exports = roomNamesModel;