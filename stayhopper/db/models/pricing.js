const db = require("../mongodb");

const pricingSchema = new db.Schema({
  from: {
    type: Date,
    required: [true,"From Date is required"]
  },
  to: {
    type: Date,
    required: [true,"To Date is required"]
  },
  property: {
    type: db.Schema.Types.ObjectId,
    ref:"properties",
    required: [true,"Property is required"]
  },
  room: {
    type: db.Schema.Types.ObjectId,
    ref:"rooms",
    required: [true,"Room is required"]
  },
  h3: {
    type: Number
  },
  h6: {
    type: Number
  },
  h12: {
    type: Number
  },
  h24: {
    type: Number
  }
});
pricingModel = db.model("pricing", pricingSchema);
module.exports = pricingModel;
