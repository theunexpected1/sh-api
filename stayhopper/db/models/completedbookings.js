const db = require("../mongodb");

const guestInfoSchema = new db.Schema({
  title: String,
  first_name: String,
  last_name: String,
  nationality: String,
  city: String,
  mobile: String,
  email: String
});

const propertySchema = new db.Schema({
  id: {
    type: db.Schema.Types.ObjectId,
    ref: "properties"
  },
  name: String,
  images: [String],
  country: String,
  city: String,
  address_1: String,
  address_2: String,
  location: String,
  zip: String
});

const roomSchema = new db.Schema({
  id: {
    type: db.Schema.Types.ObjectId,
    ref: "rooms"
  },
  images: [String],
  name: String,
  type: String,
  number:Number
});

const completedBookingsSchema = new db.Schema({
  user: {
    type: db.Schema.Types.ObjectId,
    ref:'users'
  },
  book_id:{
    type: String
  },
  ub_id:{
    type: db.Schema.Types.ObjectId
  },
  guestInfo: guestInfoSchema,
  propertyInfo: propertySchema,
  roomsInfo: [roomSchema],
  no_of_adults: Number,
  no_of_children: Number,
  checkin_time: String,
  checkin_date: String,
  date_checkin: Date,
  date_checkout: Date,
  date_booked: Date,
  currencyCode: {
    type: String,
    default: 'AED'
  },
  bookingFee: Number,
  tax: Number,
  discount: Number,
  total_amt: Number,
  latlng: {
    type: [Number]
  },
  cancel_approval:{
    type: Number,
    default:0
  },
  paid:{
    type: Boolean,
    default:0
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

completedBookingsModel = db.model(
  "completed_bookings",
  completedBookingsSchema
);
module.exports = completedBookingsModel;
