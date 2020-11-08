const db = require('../mongodb');
const contactUsSchema = new db.Schema({
    name: {
        type: String,
    },
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
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

contactUsModel = db.model('contactus', contactUsSchema);
module.exports = contactUsModel;