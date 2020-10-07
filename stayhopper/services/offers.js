const Offer = require("../db/models/offers");

const service = {
  getOffers: async () => {
    return await Offer.find({ enabled: true }).sort({createdAt: -1});
  }
};

module.exports = service;
