const express = require("express");
const router = express.Router();

const Rating = require('../../db/models/propertyratings');
const Service = require('../../db/models/services');

router.get('/ratings_and_services',async(req,res)=>{
    let ratings = await Rating.find().sort({value:1});
    let services = await Service.find().sort({name:1});
    return res.json({status:'Success',data:{ratings,services}})
});

module.exports = router;