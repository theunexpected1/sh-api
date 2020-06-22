const mongoose = require('mongoose');
const url = "mongodb+srv://saleeshprakash:jIinODzSY3zvTzue@cluster0-hoiti.mongodb.net/stayhoppers"; 
let options = {
    user: 'saleeshprakash',
    pass: 'jIinODzSY3zvTzue',
    auth: {
      authdb: 'admin'
    },
    authSource:'admin',
    useNewUrlParser: true,
    replicaSet:'Cluster0-shard-0'
};
mongoose.connect(url,options).then(()=>{
    console.log('Connected to db'); 
})
.catch((err)=>{
    console.log('Could not connected to db',err);
});
module.exports = mongoose; 
///local
const mongoose = require('mongoose');
const url = "mongodb://localhost:27017/stayhoppers"; 
let options = {
    useNewUrlParser: true
};
mongoose.connect(url,options).then(()=>{
    console.log('Connected to db'); 
})
.catch((err)=>{
    console.log('Could not connected to db',err);
});
module.exports = mongoose; 