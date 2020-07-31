const db = require("../mongodb");
const invoiceSchema = new db.Schema({
  invoiceForDate: {
    type: String
  },
  invoiceForMonthString: {
    type: String
  },
  issueDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'disabled']
  },
  property: {
    type: db.Schema.Types.ObjectId,
    ref: "properties",
    required: [true, "Property is required"]
  },
  completedBookings: [{
    type: db.Schema.Types.ObjectId,
    ref: "completed_bookings"
  }],
  userBookings: [{
    type: db.Schema.Types.ObjectId,
    ref: "userbookings"
  }],
  totalBookingsCount: Number,
  invoiceSentToProperty: {
    type: Boolean,
    default: false
  },
  reminderSentToProperty: {
    type: Boolean,
    default: false
  },
  paymentUrl: {
    type: String
  },
  currency: {
    type: db.Schema.Types.ObjectId,
    ref: "currencies"
  },
  amount: {
    type: Number,
    default: 0,
    required: [true, "Amount is required"]
  }
});

invoiceModel = db.model("invoices", invoiceSchema);
module.exports = invoiceModel;
