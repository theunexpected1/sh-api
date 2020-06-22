const express = require("express");
const router = express.Router();

const Rating = require('../../db/models/propertyratings');

router.get('/',async(req,res)=>{
    property_rating = await Rating.find().sort({value:1});
    if(property_rating){
        return res.json({status:'Success',data:property_rating});
    }else{
        return res.json({status:'Failed',message:'No data'});
    }
});

module.exports = router;