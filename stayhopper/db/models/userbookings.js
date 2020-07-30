const db = require("../mongodb");
const roomSchema = {
  room: {
    type: db.Schema.Types.ObjectId,
    ref: "rooms",
    required: [true, "Room is required"]
  },
  number: {
    type: Number,
    required: [true, "Number of rooms is required"]
  }
};
const guestinfoSchema = {
  title: {
    type: String,
    required: [true, "User Title is required"]
  },
  first_name: {
    type: String,
    required: [true, "First Name is required"]
  },
  last_name: {
    type: String
  },
  nationality: {
    type: String
  },
  city: {
    type: String
  },
  mobile: {
    type: String
  },
  email: {
    type: String
  }
};
const userbookingSchema = new db.Schema({
  book_id:{
    type:String
  },
  user: {
    type: db.Schema.Types.ObjectId,
    ref: "users",
    required: [true, "Property is required"]
  },
  property: {
    type: db.Schema.Types.ObjectId,
    ref: "properties",
    required: [true, "Property is required"]
  },
  room: [roomSchema],
  no_of_adults: {
    type: Number,
    required: [true, "Number of adults is required"]
  },
  no_of_children: {
    type: Number
  },
  selected_hours: {
    type: Number,
    required: [true, "Selected hours is required"]
  },
  checkin_time: {
    type: String,
    required: [true, "Check in time is required"]
  },
  checkout_time: {
    type: String,
    required: [true, "Check in time is required"]
  },
  checkin_date: {
    type: String,
    required: [true, "Check in date is required"]
  },
  date_booked: {
    type: Date
  },
  date_checkin: {
    type: Date
  },
  date_checkout: {
    type: Date
  },
  tax: {
    type: Number
  },
  discount: {
    type: Number
  },
  total_amt: {
    type: Number,
    required: [true, "Total amount is required"]
  },
  guestinfo: guestinfoSchema,
  trip_type: {
    type: String,
    enum: ["BUSINESS", "LEISURE"],
    default:"LEISURE"
  },
  ref:{
    type:String
  },
  cancel_request:{
    type:Boolean,
    default:0
  },
  cancel_approval:{
    type:Number,
    default:0
  },
  paid:{
    type:Boolean,
    default:0
  },
  notify_before_checkin:{
    type:Boolean,
    default:0
  },
  notify_booking_extension:{
    type:Boolean,
    default:0
  },
  parent_id:{
    type:db.Schema.Types.ObjectId
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

userbookingModel = db.model("userbookings", userbookingSchema);
module.exports = userbookingModel;
