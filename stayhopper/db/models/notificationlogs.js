const db = require('../mongodb');
const notificationLogSchema = new db.Schema({
    device_token: {
        type: String,
    },
    type: {
        type: String,
    },
    status:{
        type: String
    },
    booking_id:{
        type: db.Schema.ObjectId,
        ref:"userbooking"
    }
});

notificationLogModel = db.model('notificationlogs', notificationLogSchema);
module.exports = notificationLogModel;