const db = require('../mongodb');
const termsandconditionsSchema = new db.Schema({
    description: {
        type: String,
    }
});

termsandconditionsModel = db.model('termsandconditions', termsandconditionsSchema);
module.exports = termsandconditionsModel;