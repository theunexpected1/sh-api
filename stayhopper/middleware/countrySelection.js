const config = require('config');
const Country = require("../db/models/countries");

// Select a default country for the user, if none are selected
module.exports = async (req, res, next) => {

  const usersCountry = req.country || config.countryId.UAE;
  const country = await Country.findOne({_id: usersCountry});

  // Set defaults
  req.country = usersCountry;
  req.timezone = country.timezone || 'Asia/Dubai';

	next();
};
