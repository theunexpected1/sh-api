const db = require('../mongodb');
const bookingLogSchema = new db.Schema({
    property: {
        type: db.Schema.Types.ObjectId,
        required:[true,"Property is required"],
        ref:"properties"
    },
    date: {
        type: String,
        required:[true,"Date is required"]
    },
    timestamp: {
        type: Date,
        required:[true,"Timestamp is required"]
    },
    room: {
        type: db.Schema.Types.ObjectId,
        required:[true,"Room is required"],
        ref:"rooms"
    },
    number:{
        type:Number,
        required:[true,"Room Number is required"]
    },
    slot:{
        type: db.Schema.Types.ObjectId,
        required:[true,"Slot is required"],
        ref:"slots"
    },
    userbooking:{
        type: db.Schema.Types.ObjectId,
        ref:"userbookings",
        default:null
    }
});

bookingLogModel = db.model('bookinglogs', bookingLogSchema);
module.exports = bookingLogModel;