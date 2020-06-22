const db = require('../mongodb');
const blockSlotsSchema = new db.Schema({
    from_date: {
        type: String
    },
    to_date: {
        type: String
    },
    room:{
        type: String
    },
    property:{
        type: String
    },
    from_slot:{
        type: String
    },
    to_slot:{
        type: String
    },
    block_type:{
        type: String,
        enum:['UNBLOCK','BLOCK'],
        default:"BLOCK"
    },
    status:{
        type:Boolean,
        default:0        
    },
    is_last:{
        type:Boolean,
        default:false
    },
    user_email:{
        type:String
    }
});

blockSlotsModel = db.model('cron_blockslots', blockSlotsSchema);
module.exports = blockSlotsModel;