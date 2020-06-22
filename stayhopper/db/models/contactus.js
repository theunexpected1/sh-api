const db = require('../mongodb');
const contactUsSchema = new db.Schema({
    email: {
        type: String,
    },
    subject: {
        type: String,
    },
    message: {
        type: String,
    },
    date:{
        type: Date,
        default: Date.now
    }
});

contactUsModel = db.model('contactus', contactUsSchema);
module.exports = contactUsModel;