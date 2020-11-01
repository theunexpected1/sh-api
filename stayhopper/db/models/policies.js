const db = require('../mongodb');
const policiesSchema = new db.Schema({
    name: {
        type: String,
    },
    image: {
        type: String,
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

policiesModel = db.model('privacy_policies', policiesSchema);
module.exports = policiesModel;