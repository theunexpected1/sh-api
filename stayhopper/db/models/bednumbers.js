const db = require("../mongodb");
const bcrypt = require("bcrypt");

const bedNumbersSchema = new db.Schema({
  name: {
    type: String
  },
  value: {
    type: Number
  },
  image: {
    type: String
  }
}, {
  timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
  }
});

bedNumbersModel = db.model("bed_numbers", bedNumbersSchema);
module.exports = bedNumbersModel;
