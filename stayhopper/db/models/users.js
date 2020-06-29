const db = require('../mongodb');
var uniqueValidator = require("mongoose-unique-validator");
var validateEmail = function(email) {
    var re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return re.test(email)
};

const usersSchema = new db.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
    },
    last_name: {
        type: String
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        required: [true, 'Email is required'],
        validate: [validateEmail, 'Please fill a valid email address'],
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    mobile: {
        type: String,
        trim: true
    },
    city:{
        type: String
    },
    country:{
        type: String
    },
    image:{
        type: String
    },
    password:{
        type: String,
        required: [true, 'Password is required'],
    },
    favourites: [{ type: db.Schema.Types.ObjectId, ref: "properties" }],
    status: {
        type: Number,
        default: 1
    },
    promocodes: [String],
    device_type:String,
    device_token:String
});

usersSchema.plugin(uniqueValidator, { message: "{PATH} to be unique." });
usersSchema.methods.validPassword = async function(password) {
    return await bcrypt.compare(password, this.password)
};

usersModel = db.model('users', usersSchema);
module.exports = usersModel;