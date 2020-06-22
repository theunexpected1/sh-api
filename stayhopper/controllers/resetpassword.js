const db = require("../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt');


const passwordSchema = {
    old_password: joi.string().required(),
    new_password: joi.string().required(),
    confirm_password: joi.string().required(),
    id: joi.string().required(),
}
const Admins = require("../db/models/hoteladmins");

router.get('/', async (req, res) => {
    let session = req.session;
    let data = {
        'session': session,
    }
    res.render('resetpassword/reset', data)
})
router.post('/', async (req, res) => {
    const admin = await Admins.findOne({ _id: req.body.id })
    const valid = joi.validate(req.body, passwordSchema, { abortEarly: false });
    if (req.body.new_password != req.body.confirm_password) {
        return res.status(200).json({ 'status': 0, 'message': 'Password and Confirm password must be same' });
    }
    var valid1 = await bcrypt.compare(req.body.old_password, admin.password);
    if (valid1) {
        var errors = [];
        if (valid.error) {
            errors = valid.error.details.map((error) => {
                return error.message;
            });
        }
        if (errors.length > 0) {
            return res.status(200).json({ 'status': 0, 'errors': errors });
        }
        const admin1 = await Admins.findOne({ _id: req.body.id })
        if (admin1) {
            admin1.password =await bcrypt.hashSync(req.body.new_password, 10);
            try {
                let result = await admin1.save();
                if (result) {
                    return res.json({ 'status': 1, 'message': 'Password updated successfully', 'data': result });
                }
            } catch (error) {
                console.log(error)
                var errors = [];
                for (field in error.errors) {
                    errors.push(error.errors[field].message);
                }
                return res.json({ status: 0, errors: errors });
            }
        } else {
            return res.json({ 'status': 0, 'message': 'user not found' });
        }
    } else {
        return res.json({ 'status': 0, 'message': 'Current Password not matching.' })
    }
})
module.exports = router;