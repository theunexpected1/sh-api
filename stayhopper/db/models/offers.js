const db = require('../mongodb');

const offersSchema = new db.Schema({
  title: {
    type: String
  },
  subtitle: {
    type: String
  },
  image: {
    type: String
  },
  link: {
    type: String
  },
  enabled: {
    type: Boolean,
    default: false
  },
  // weightage: {
  //   type: Number
  // }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

offersModel = db.model('offers', offersSchema);
module.exports = offersModel;