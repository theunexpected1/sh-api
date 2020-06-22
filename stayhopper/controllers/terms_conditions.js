const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();

const Termsandconditions = require('../db/models/termsandconditions');
//list
router.get('/', async(req, res) => {
    let result = await Termsandconditions.findOne({});
    let data = {
        'result': result,
    }
    res.render('termsandconditions/list', data);
})

//insert
router.post('/', async(req, res) => {
    let description = req.body.description;
    if (!description) {
      return res.json({ status: 0, message: "Description is required" });
    }
    let termsandcondition = new Termsandconditions();
    termsandcondition.description = description;
    try {
        var result = await Termsandconditions.findByIdAndUpdate({ _id: req.body.id }, {
            $set: {
                description: req.body.description
            }
        })
      return res.json({
        status: 1,
        message: "Terms and Condition Updated successfully!",
        id: termsandcondition._id
      });
    } catch (error) {
      var errors = [];
      for (field in error.errors) {
        errors.push(error.errors[field].message);
      }
      return res.json({ status: 0, errors: errors });
    }

})

module.exports = router;