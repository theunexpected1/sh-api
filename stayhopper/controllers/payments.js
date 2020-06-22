const db = require("../db/mongodb");
const express = require("express");
const router = express.Router();

const Property = require("../db/models/properties");
const Countries = require("../db/models/countries");
const Currency = require("../db/models/currencies");
const Tax = require("../db/models/taxes");
const path = require("path");
const _ = require("underscore");
const config = require('config');

const propertiesCrump = require("../middleware/propertiesCrump");

router.get('/:id', propertiesCrump,async(req,res)=>{
  let currencies = await Currency.find();
  let countries = await Countries.find();
  let property = await Property.findOne({_id:req.params.id});
  let tax_details = await Tax.findOne({});
  if(property.payment){
    payment = property.payment;
  }else{  
    payment = {};
  } 
  let data = {
    currencies,
    countries,
    property,
    payment,
    tax_details,
    vat:config.vat
  }
  res.render('payments/list',data);
});
router.post('/',async(req,res)=>{
  let property_id = req.body.property_id;
  if(property_id){
    property = await Property.findOne({_id:property_id});
    if(property){
      let data = {
        name : req.body.account_name,
        country : req.body.country,
        bank : req.body.bank,
        branch : req.body.branch,
        account_no : req.body.account_no,
        ifsc : req.body.ifsc,
        currency : req.body.currency,
        tax : req.body.tax,
        tourism_fee : req.body.tourism_fee,
        muncipality_fee : req.body.muncipality_fee,
        service_charge : req.body.service_charge,
      } 
      if(! property.payment){
        data.excluding_vat = config.vat;
      }
      property.payment = data;
      // property.approved = true;
      try{
        await property.save();
        return res.json({status:1,message:"Payment details saved successfully"}); 
      }catch(error){
        console.log(error);
        return res.json({status:0,message:"Could not update payment details"});        
      }
    }else{
      return res.json({status:0,message:"Could not update payment details"});
    }
  }else{
    return res.json({status:0,message:"Could not save payment details"});
  }
});
module.exports = router;
