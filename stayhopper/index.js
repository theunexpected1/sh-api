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

const webRouter = require('./routes/web');
const apiRouter = require('./routes/api');
const adminRouter = require('./admin/routes/web');
const testRouter = require('./routes/test');

//middleware
const requireLogin = require('./middleware/requiresLogin');
const cronjobs = require('./cron');

app.use(helmet());
app.use(morgan('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.use('/public', express.static('public'));
app.set('view engine','ejs');

//use sessions for tracking logins
app.use(session({
    secret: 'MySecRetKeyisThis',
    resave: true,
    saveUninitialized: false
}));


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