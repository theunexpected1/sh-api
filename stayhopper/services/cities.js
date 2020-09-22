const City = require("../db/models/cities");

const service = {
  getAverageDailyPriceForCity: async city => {
    return parseInt(Math.random() * 300);
  },

  getCityWithAverageDailyPrice: async (city) => {
    return {
      ...city,
      price: await service.getAverageDailyPriceForCity(city)
    }
  },

  getCitiesWithAverageDailyRate: async () => {
    const cities = await City
      .find({})
      .populate('country')
      .lean()
    ;
    return await Promise.all(cities.map(service.getCityWithAverageDailyPrice));
  }
};

module.exports = service;