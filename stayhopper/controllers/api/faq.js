const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();

const Faq = require('../../db/models/faq')

router.get('/', async(req, res) => {
    try {
        var faq = await Faq.find()
        if(req) {
            return res.json({ status: 'Success', data: faq })
        } else {
            return res.json({ status: 'Failed', message: 'FAQ not found' })
        }
    } catch(err) {
        return res.json({ 'status': 'Failed', message: err.message })
    }
})

module.exports = router;