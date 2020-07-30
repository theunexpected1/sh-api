const db = require("../mongodb");
const slotsSchema = new db.Schema({
  label: {
    type: String
  },
  no: {
    type: String
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

slotsModel = db.model("slots", slotsSchema);
module.exports = slotsModel;
