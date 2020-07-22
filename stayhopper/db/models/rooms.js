const db = require("../mongodb");
const bcrypt = require("bcrypt");

const pricingSchema = new db.Schema({
  h3: Number,
  h6: Number,
  h12: Number,
  h24: Number
});

const hoursSchema = new db.Schema({
  h0: Number,
  h1: Number,
  h2: Number,
  h3: Number,
  h4: Number,
  h5: Number,
  h6: Number,
  h7: Number,
  h8: Number,
  h9: Number,
  h10: Number,
  h11: Number,
  h12: Number,
  h13: Number,
  h14: Number,
  h15: Number,
  h16: Number,
  h17: Number,
  h18: Number,
  h19: Number,
  h20: Number,
  h21: Number,
  h22: Number,
  h23: Number
})

const ratesSchema = new db.Schema({
  name: String,
  weekday: {
    fullDay: {
      type: Number
    },
    standardDay: {
      type: Number
    },
    hours: hoursSchema,
  },
  weekend: {
    fullDay: {
      type: Number
    },
    standardDay: {
      type: Number
    },
    hours: hoursSchema,
  },
  dateFrom: Date,
  dateTo: Date,
  recurring: Boolean,
  isDefault: {
    type: Boolean,
    default: false
  },
  rateType: {
    type: String,
    enum: ['short-term', 'long-term']
  }
})

// Access:
// room.rates.weekday.fullDay
// room.rates.standardDay
// room.rates.hours.h0
// room.rates.hours.h1
// room.rates.hours['h0']
// room.rates.hours['h1']

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
  number_of_guests: {
    type: db.Schema.Types.ObjectId,
    ref: "guest_numbers"
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
  hours_cleaning: {
    type: Number,
    default: 0
  },
  price: pricingSchema,
  rates: [ratesSchema],
  services: [{ type: db.Schema.Types.ObjectId, ref: "services" }],
  images: [String],
  featured: [String],
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

// Avoid adding default rates, let the hotels set this themselves
// roomsSchema.pre('save', function (next) {
//   var room = this;

//   // Add Default Room Rates (Short Term & Long Term)
//   if (room.isNew) {
//     const defaultRate = {
//       fullDay: 0,
//       standardDay: 0,
//       hours: {
//         h0: 0,
//         h1: 0,
//         h2: 0,
//         h3: 0,
//         h4: 0,
//         h5: 0,
//         h6: 0,
//         h7: 0,
//         h8: 0,
//         h9: 0,
//         h10: 0,
//         h11: 0,
//         h12: 0,
//         h13: 0,
//         h14: 0,
//         h15: 0,
//         h16: 0,
//         h17: 0,
//         h18: 0,
//         h19: 0,
//         h20: 0,
//         h21: 0,
//         h22: 0,
//         h23: 0
//       }
//     };

//     const defaultShortTermRates = {
//       weekday: defaultRate,
//       weekend: defaultRate,
//       isDefault: true,
//       rateType: 'short-term' // or 'long-term'
//     }
//     const defaultLongTermRates = {
//       weekday: defaultRate,
//       weekend: defaultRate,
//       isDefault: true,
//       rateType: 'long-term' // or 'long-term'
//     }

//     room.rates = [
//       defaultShortTermRates,
//       defaultLongTermRates
//     ];
//     next();
//   } else {
//     next();
//   }
// });

roomsModel = db.model("rooms", roomsSchema);
module.exports = roomsModel;
