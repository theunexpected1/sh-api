const db = require("../mongodb");
const invoiceSchema = new db.Schema({
  invoiceNo: {
    type: String
  },
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
    enum: ['paid', 'pending']
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
  invoiceSentToPropertyDate: {
    type: Date
  },
  reminderSentToProperty: {
    type: Boolean,
    default: false
  },
  reminderSentToPropertyDate: {
    type: Date
  },
  paymentUrl: {
    type: String
  },
  currency: {
    type: db.Schema.Types.ObjectId,
    ref: "currencies"
  },
  amountToProperty: {
    type: Number,
    default: 0
  },
  amountFromProperty: {
    type: Number,
    default: 0
  },
  commissionHourly: Number,
  commissionMonthly: Number,
  amount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

invoiceModel = db.model("invoices", invoiceSchema);
module.exports = invoiceModel;
