let active_db = ''; 
const mongoose = require('mongoose');
let config = {};

switch (process.env.NODE_ENV) {
    case 'staging':
        active_db = 'staging'
        break;
    case 'vrbros-staging':
    default:
        active_db = ''
}
if(active_db == 'staging'){ 
    config = {
        url: "mongodb+srv://sh-staging:43557568845@cluster0-h5b9f.mongodb.net/stay",
        options:{
            user: 'sh-staging',
            pass: '43557568845',
            auth: {
                authdb: 'admin'
            },
            authSource: 'admin', 
            useNewUrlParser: true,
            replicaSet: 'Cluster0-shard-0'
        }
    }
}else if (active_db == 'demo-live'){
    config = {
        url: "mongodb+srv://sh-staging:43557568845@cluster0-h5b9f.mongodb.net/sh-staging-db",
        options:{
            user: 'saleeshprakash',
            pass: 'jIinODzSY3zvTzue',
            auth: {
                authdb: 'admin'
            },
            authSource: 'admin',
            useNewUrlParser: true,
            replicaSet: 'Cluster0-shard-0'
        }
    }
} else {
    config = {
        url: "mongodb://localhost:27017/stay",
        options: {
            useNewUrlParser: true
        }
    }
}
mongoose.connect(config.url,config.options).then(() => {
    console.log('[NODE_ENV:' + process.env.NODE_ENV + '] Connected to db', config.url);
})
.catch((err) => {
    console.log('Could not connected to db', err);
});
module.exports = mongoose;

