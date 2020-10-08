const Offer = require("../db/models/offers");

const service = {
  getOffers: async () => {
    const offers = await Offer.find({ enabled: true }).sort({createdAt: -1});
    const count = await Offer.countDocuments({ enabled: true });
    return {
      list: offers,
      count,
      page: 1,
      totalPages: 1
    }
  }
};

module.exports = service;
