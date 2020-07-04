const bcrypt = require("bcrypt");
const User = require("../db/models/users");
const Administrator = require("../db/models/administrators");
const Role = require("../db/models/roles");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

passport
  .use('local-administrator-login', new LocalStrategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField : 'username',
    passwordField : 'password',
    session: false
  }, (email, password, done) => {
    Administrator
      .findOne({email})
      .populate('role')
      .select('+email')
      .select('+password')
      .exec(async (err, administrator) => {
        if (err) { return done(err); }
        if (!administrator) {
          return done(null, false, { message: 'Incorrect email.' });
        }

        const isValidPassword = await administrator.validPassword(password);
        if (!isValidPassword) {
          return done(null, false, {message: 'Incorrect password.'});
        }

        return done(null, administrator);
      })
    ;
  }
));

passport.use('local-user-login', new LocalStrategy({
  // by default, local strategy uses username and password, we will override with email
  usernameField : 'email',
  passwordField : 'password',
  passReqToCallback : true // allows us to pass back the entire request to the callback
}, (req, email, password, done) => {
    User.findOne({
      email,
      password
    }, function (err, user) {
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Incorrect email.' });
      }
      if (!user.validPassword(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));

passport.use('jwt-administrator', new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.API_SECRET || 'secret'
}, (jwtPayload, cb) => {

  if (!jwtPayload || !jwtPayload._id) {
    return cb(new Error('Payload empty'));
  }

  return Administrator
    .findById(jwtPayload._id)
    .populate('role')
    .then(user => {
      return cb(null, user);
    })
    .catch(err => {
      return cb(err);
    })
  ;
}));

passport.use('jwt-user', new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.API_SECRET || 'secret'
}, (jwtPayload, cb) => {

  if (!jwtPayload || !jwtPayload._id) {
    return cb(new Error('Payload empty'));
  }

  return User
    .findById(jwtPayload._id)
    .then(user => {
      return cb(null, user);
    })
    .catch(err => {
      return cb(err);
    })
  ;
}));

// Serialize user
passport.serializeUser(function(user, done) {
  done(null, user);
});

// Deserialize user
passport.deserializeUser(function(user, done) {
  done(null, user);
});