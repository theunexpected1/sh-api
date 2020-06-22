const db = require('../mongodb');
const policiesSchema = new db.Schema({
    name: {
        type: String,
    },
    image: {
        type: String,
    }
});

policiesModel = db.model('privacy_policies', policiesSchema);
module.exports = policiesModel;