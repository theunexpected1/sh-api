const passport = require('passport');
const administratorAuthenticationRequired = (req, res, next) => passport.authenticate('jwt-administrator', {session: false})(req, res, next);
const userAuthenticationRequired = (req, res, next) => passport.authenticate('jwt-user', {session: false})(req, res, next);

module.exports = {
  administratorAuthenticationRequired,
  userAuthenticationRequired
}