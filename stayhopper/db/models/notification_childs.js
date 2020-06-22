const db = require('../mongodb');
const notificationChildsSchema = new db.Schema({
    notification_id:{
        type:db.Schema.Types.ObjectId,
        ref:"notifications"
    },
    user_id: {
        type:db.Schema.Types.ObjectId,
        ref:"users"
    },
    read_status:{
        type:Boolean,
        default:false
    }
});

notificationsModel = db.model('notification_childs', notificationChildsSchema);
module.exports = notificationsModel;