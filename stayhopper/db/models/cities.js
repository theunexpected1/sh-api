const db = require('../mongodb');
const citiesSchema = new db.Schema({
    name: String,
    image: String,
    featured : {
        type: Boolean,
        default: false
    }
});

citiesModel = db.model('cities', citiesSchema);
module.exports = citiesModel;