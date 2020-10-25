const service = {
  // value, singular text, plural test
  pluralize: (val, singular, plural) => val === 1 ? singular : plural,
};

module.exports = service;