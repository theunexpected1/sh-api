const db = require('../mongodb');
const faqSchema = new db.Schema({
    title: {
        type: String,
    },
    description: {
        type: String,
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

faqModel = db.model('faq', faqSchema);
module.exports = faqModel;