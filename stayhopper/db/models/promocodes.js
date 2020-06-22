const db = require('../mongodb');
const promoCodeSchema = new db.Schema({
    code: {
        type: String,
    },
    discount: {
        type: Number,
    }
});

promoCodeModel = db.model('promocodes', promoCodeSchema);
module.exports = promoCodeModel;