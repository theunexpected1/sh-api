const db = require('../mongodb');
const faqSchema = new db.Schema({
    title: {
        type: String,
    },
    description: {
        type: String,
    }
});

faqModel = db.model('faq', faqSchema);
module.exports = faqModel;