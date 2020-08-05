module.exports = function (req, res, next) {

	var allowedOrigins = [
		'http://localhost:3000',
		'http://localhost:3001',
		'http://localhost:5000',
    'http://local.stayhopper.com:3001',
		'https://admin.sh.vrbrosllc.com',
		'https://stayhopper-admin.web.app'
	];
	var origin = req.headers.origin;

	if (allowedOrigins.indexOf(origin) > -1){
		res.setHeader('Access-Control-Allow-Origin', origin);
	}

	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
	res.header('Access-Control-Allow-Headers', 'Content-Type,x-access-token,token,Authorization,If-None-Match');
	res.header('Access-Control-Allow-Credentials', true);

	next();
};
