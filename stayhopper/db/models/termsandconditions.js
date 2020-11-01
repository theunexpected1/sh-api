const db = require('../mongodb');
const termsandconditionsSchema = new db.Schema({
    description: {
        type: String,
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

termsandconditionsModel = db.model('termsandconditions', termsandconditionsSchema);
module.exports = termsandconditionsModel;