const db = require('../mongodb');
const bcrypt = require('bcrypt');

const roomNamesSchema = new db.Schema({
    name: {
        type: String,
    },
    image: {
        type: String,
    }
});

roomNamesModel = db.model('room_names', roomNamesSchema);
module.exports = roomNamesModel;