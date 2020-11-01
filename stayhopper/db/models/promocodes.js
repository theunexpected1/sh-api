const db = require('../mongodb');
const promoCodeSchema = new db.Schema({
    code: {
        type: String,
    },
    discount: {
        type: Number,
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

promoCodeModel = db.model('promocodes', promoCodeSchema);
module.exports = promoCodeModel;