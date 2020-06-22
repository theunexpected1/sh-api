const db = require("../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();

router.get('/',async(req,res)=>{
    res.render('generalsettings/list');
});

module.exports = router;