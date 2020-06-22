const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();

const Termsandconditions = require('../../db/models/termsandconditions');

router.get('/', async(req, res) => {
    try{
        var result = await Termsandconditions.find()
        if(result) {
            return res.json({ status: 'Success', data: result })
        } else {
            return releaseEvents.json({ status: 'Failed', message: 'Terms and condition not found' })
        }
    } catch (err) {
        return res.json({ status: 'Failed', message: 'Terms and condition not found' })
    }
})

module.exports = router;