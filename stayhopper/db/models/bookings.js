const db = require('../mongodb');
const slotSchema = {
    slot : {
        type :  db.Schema.Types.ObjectId,
        ref : 'slots',
        required : [true,'Slot is required']
    },
    number : {
        type : Number,
        required : [true,'Slot Number is required']
    },
    status : {
        type : String,
        enum : ['BLOCKED','BOOKED','RESERVED'],
        default: 'BLOCKED'
    },
    userbooking:{
        type :  db.Schema.Types.ObjectId,
        ref : 'userbookings'
    }
}
const bookingSchema = new db.Schema({
    property: {
        type: db.Schema.Types.ObjectId,
        ref : 'properties',
        required : [true,'Property is required']
    },
    room: {
        type: db.Schema.Types.ObjectId,
        ref : 'rooms',
        required : [true,'Room is required']
    },
    date: {
        type: String,
        required : [true,'Date is required']
    },
    slots : [slotSchema]
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

bookingModel = db.model('bookings', bookingSchema);
module.exports = bookingModel;