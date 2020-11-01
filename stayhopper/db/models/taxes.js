const db = require('../mongodb');
const taxesSchema = new db.Schema({
    name: {
        type: String,
    },
    value: {
        type: Number,
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

taxesModel = db.model('taxes', taxesSchema);
module.exports = taxesModel;