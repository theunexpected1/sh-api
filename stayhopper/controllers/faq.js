const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();

const Faq = require('../db/models/faq')

router.get('/', async (req, res) => {
    let faqs = await Faq.find()
    let data = {
        'faqs': faqs,
    }
    res.render('faq/list', data);
})
//insert
router.post('/', async (req, res) => {
    let title = req.body.title;
    let description = req.body.description;
    if (!title) {
        return res.json({ status: 0, message: "Title is required" });
    }
    if (!description) {
        return res.json({ status: 0, message: "Description is required" });
    }
    let faq = new Faq();
    faq.title = title;
    faq.description = description;
    try {
        await faq.save();
        return res.json({
            status: 1,
            message: "FAQ Added successfully!",
            id: faq._id
        });
    } catch (error) {
        console.log(error)
        var errors = [];
        for (field in error.errors) {
            errors.push(error.errors[field].message);
        }
        return res.json({ status: 0, errors: errors });
    }
})
//edit
router.get("/:id", async (req, res) => {
    let id = req.params.id;
    let faq = await Faq.findOne({ _id: id });
    if (faq) {
        return res.json({ status: 1, data: faq });
    } else {
        return res.json({ status: 0, message: "No data" });
    }
});

//update
router.post('/update', async (req, res) => {
    let faq = await Faq.findOne({ _id: req.body.id });
    faq.title = req.body.title;
    faq.description = req.body.description;
    try {
        await faq.save();
        return res.json({
            status: 1,
            message: "FAQ Updated successfully!",
            id: faq._id
        });
    } catch (error) {
        console.log(error)
        var errors = [];
        for (field in error.errors) {
            errors.push(error.errors[field].message);
        }
        return res.json({ status: 0, errors: errors });
    }
})
//delte
router.get('/delete/:id', async (req, res) => {
    let id = req.params.id;
    try {
        var faq = await Faq.deleteOne({ _id: id });
        if (faq) {
            return res.json({ status: 1, message: "Deleted successfully!" });
        } else {
            return res.json({ status: 0, message: "Could not delete proeprty type!" });
        }
    } catch (err) {
        console.log(err)
    }

})
module.exports = router;