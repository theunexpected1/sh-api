const db = require("../mongodb");
const bcrypt = require("bcrypt");

const pricingSchema = new db.Schema({
  h3: Number,
  h6: Number,
  h12: Number,
  h24: Number
});
const roomsSchema = new db.Schema({
  property_id: {
    type: db.Schema.Types.ObjectId,
    required: true,
    ref: "properties"
  },
  room_type: {
    type: db.Schema.Types.ObjectId,
    required: true,
    ref: "room_types"
  },
  number_rooms: {
    type: Number,
    required: true
  },
  room_name: {
    type: db.Schema.Types.ObjectId,
    ref: "room_names"
  },
  bed_type: {
    type: db.Schema.Types.ObjectId,
    required: true,
    ref: "bed_types"
  },
  custom_name: {
    type: String
  },
  number_guests: {
    type: Number
  },
  number_beds: {
    type: Number
  },
  extrabed_option: {
    type: Boolean
  },
  extrabed_number: {
    type: Number
  },
  amount_extrabed: {
    type: Number
  },
  room_size: {
    type: String
  },
  extraslot_cleaning: {
    type: Number
  },
  price: pricingSchema,
  services: [{ type: db.Schema.Types.ObjectId, ref: "services" }],
  images: [String],
  featured: [String],

});

roomsModel = db.model("rooms", roomsSchema);
module.exports = roomsModel;
