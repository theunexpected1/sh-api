const active_db = 'client-live'; 
const mongoose = require('mongoose');
let config = {};
if(active_db == 'client-live'){ 
    config = {
        url: "mongodb+srv://sh-staging:43557568845@cluster0-h5b9f.mongodb.net/sh-staging-db",
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
}else{
    config = {
        url: "mongodb://localhost:27017/stayhopper",
        options:{
            useNewUrlParser: true
        }
    }
}
mongoose.connect(config.url,config.options).then(() => {
    console.log('Connected to db');
})
.catch((err) => {
    console.log('Could not connected to db', err);
});
module.exports = mongoose;

