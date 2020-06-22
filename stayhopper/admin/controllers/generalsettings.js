const db = require("../../db/mongodb");
const joi = require("joi");
const bcrypt = require("bcrypt");
const express = require("express");
const router = express.Router();

router.get('/',async(req,res)=>{
    res.render('admin/generalsettings/list');
});

module.exports = router;