const session = require('express-session');
const helmet = require('helmet');
const config = require('config');
const multer = require('multer');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const express = require('express');
const cron = require("node-cron");
const fs = require("fs");
const app = express();
const dotenv = require('dotenv');
const passport = require('passport');
const dotenvResult = dotenv.config()

const webRouter = require('./routes/web');
const apiRouter = require('./routes/api');
const adminRouter = require('./admin/routes/web');
const testRouter = require('./routes/test');

//middleware
const requireLogin = require('./middleware/requiresLogin');
const passportConfig = require('./middleware/passport-administrator');
const cronjobs = require('./cron');
const allowedCORS = require('./middleware/allowed-cors');

app.use(helmet());
app.use(morgan('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(allowedCORS);

app.use('/public', express.static('public'));
app.set('view engine','ejs');

//use sessions for tracking logins
app.use(session({
    secret: 'MySecRetKeyisThis',
    resave: true,
    saveUninitialized: false
}));

// Use JWT-based login for Administrators
app.use(passport.initialize());

//router
    app.use('/',webRouter);
    app.use('/api',apiRouter);
    app.use('/admin',adminRouter);
    app.use('/test',testRouter);
//end router


const port = process.env.PORT||3000;
app.listen(port,()=>{
    console.log(`listening to port ${port}`);
});