const db = require("../mongodb");
const slotsSchema = new db.Schema({
  label: {
    type: String
  },
  no: {
    type: String
  }
});

slotsModel = db.model("slots", slotsSchema);
module.exports = slotsModel;
