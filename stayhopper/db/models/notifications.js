const db = require('../mongodb');
const notificationsSchema = new db.Schema({
    title: {
        type: String,
    },
    description: {
        type: String,
    },
    book_id:{
        type:db.Schema.Types.ObjectId,
        ref:"userbookings"
    },
    booking_no:{
        type:String
    },
    notification_type:{
        type:String,
        enum:['GENERAL','EXTEND','BOOKED','REVIEW'],
        default:'GENERAL'               
    },
    device_token:{
        type:String
    },
    property_name:{
        type:String
    },
    property_id:{
        type:db.Schema.Types.ObjectId,
        ref:"properties"
    }
});

notificationsModel = db.model('notifications', notificationsSchema);
module.exports = notificationsModel;