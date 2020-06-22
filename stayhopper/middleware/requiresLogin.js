const requiresLogin = (req, res, next) => {
  let session = req.session;
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  // let url = req.originalUrl;
  // let uri_segments = url.split('/');
  // let group = uri_segments[1];
  if (session && session._id && !session.admin) {
    res.locals.session = req.session;
    res.locals.active = "";
    res.locals.parent = "";
    next();
  } else if (session && session._id && session.admin) {
    return res.redirect("/admin");
  }else{
    return res.redirect("/");
  }
};

module.exports = requiresLogin;
