const config = require('config');

// Select a default country for the user, if none are selected
module.exports = function (req, res, next) {

  console.log('in middleware countrySelection req.params', req.usersCountry);
  // req.params = req.params || {};
  // req.params.usersCountry = req.params.usersCountry || config.countryId.UAE;
  req.usersCountry = req.usersCountry || config.countryId.UAE;
  console.log('in middleware countrySelection req.usersCountry', req.usersCountry);

	next();
};
