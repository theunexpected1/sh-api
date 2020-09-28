const db = require('../mongodb');
const moment = require('moment');
const Slot = require('./slots');
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
    slotStartTime: {
        type: Date
    },
    userbooking:{
        type: db.Schema.Types.ObjectId,
        ref:"userbookings",
        default:null
    }
});

bookingLogSchema.pre('save', function (next) {
    var bookingLog = this;
    console.log('looking for slot')
    if (booking && bookingLog.slot && bookingLog.date && !bookingLog.slotStartTime) {
        console.log('bookingLog.slotStartTime missing!... adding via pre-save hook!')
        Slot
            .findOne({_id: bookingLog.slot})
            .then((err, slot) => {
                console.log('slot', slot);
                const slotStartTime = moment(`${bookingLog.date} ${slot.label}`, 'YYYY-MM-DD HH:mm');
                console.log('slotStartTime', slotStartTime);

                bookingLog.slotStartTime = slotStartTime;
                next();
            })
        ;
    } else {
        next();
    }
    next();
})

bookingLogModel = db.model('bookinglogs', bookingLogSchema);
module.exports = bookingLogModel;