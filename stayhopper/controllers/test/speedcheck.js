const db = require("../../db/mongodb");
const express = require("express");
const router = express.Router();

const Slot = require("../../db/models/slots");
const Property = require("../../db/models/properties");

const bcrypt = require("bcrypt");

router.get("/slots", async (req, res) => {
  let data_res = await Slot.find();

  return res.json({ status: data_res });
  //return res.json({status:"success"});
});

router.get("/properties", async (req, res) => {
  let data_res = await Property.find();

  return res.json({ status: data_res });
  //return res.json({status:"success"});
});

router.get("/generate", async (req, res) => {
  let password = await bcrypt.hashSync("password", 10);
  return res.json({ password });
});
module.exports = router;
