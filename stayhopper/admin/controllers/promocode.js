const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const pify = require("pify");
const multer = require("multer");
const path = require("path");

const PromoCode = require("../../db/models/promocodes");

router.get("/", async (req, res) => {
  let promocodes = await PromoCode.find();
  let data = {
    promocodes
  };
  res.render("admin/promocodes/list", data);
});

router.post("/", async (req, res) => {
    let promocodes = req.body.promocode;
    let discount = req.body.discount;
    if(promocodes && discount){
        let promocode = await PromoCode.findOne(); 
        if(promocode){
            promocode.code = promocodes;
            promocode.discount = discount;
            try{
                await promocode.save();
                return res.json({status:1,message:"Promocode save successfully"});
            }catch(error){
                console.log(error);
                return res.json({status:0,message:"Promocode could not update"});
            }
        }else{
            promocode = new PromoCode();
            promocode.code = promocodes;
            promocode.discount = discount;
            try{
                await promocode.save();
                return res.json({status:1,message:"Promocode save successfully"});
            }catch(error){
                console.log(error);
                return res.json({status:0,message:"Promocode could not update"});
            }
        }
    }else{
        return res.json({status:0,message:"Promocode could not update"});
    }
});
module.exports = router;
