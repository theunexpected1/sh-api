const db = require('../mongodb');
const userRatingSchema = new db.Schema({
    user: {
        type: db.Schema.Types.ObjectId,
        ref:'users',
        required: [true,'User details required']
    },
    ub_id:{
        type:db.Schema.Types.ObjectId,
        required:true
    },
    booking_id:{
        type:String,
        default:""
    },
    property: {
        type: db.Schema.Types.ObjectId,
        ref:'properties',
        required: [true,'Property details required']
    },
    comment: {
        type: String,
        required: [true,'User comment is required']
    },
    value:{
        type: Number,
        required: [true,'Rating value is required']
    },
    date:{
        type: Date
    },
    approved:{
        type: Boolean,
        default: false
    },
});

userRatingModel = db.model('userratings', userRatingSchema);
module.exports = userRatingModel;