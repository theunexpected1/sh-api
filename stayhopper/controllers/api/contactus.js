const db = require("../../db/mongodb");
const joi = require("joi");
const express = require("express");
const router = express.Router();
const config = require("config");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const fs = require("fs");

const ContactUs = require('../../db/models/contactus');

router.post('/', async(req, res) => {
    let email = req.body.email;
    let subject = req.body.subject;
    let message = req.body.message;
    let contactus = new ContactUs();
    let date = new Date();
    date = date.toLocaleString();
    contactus.email = email;
    contactus.subject = subject;
    contactus.message = message;
    await contactus.save();
    let html_body = fs.readFileSync('public/app-message.html', 'utf8');
    html_body = html_body.replace('{{USERNAME}}',email);
    html_body = html_body.replace('{{EMAIL}}',subject);
    html_body = html_body.replace('{{MSGDATE}}',date);
    html_body = html_body.replace('{{MSG}}',message);

    msg = {
      to: config.website_contactus_email,
      bcc: [{ email: 'saleesh.pp@iroidtechnologies.com'}],//config.website_admin_bcc_email
      from: config.website_admin_from_email,
      subject: "STAYHOPPER: New Message, "+subject,
      text:
        "Contact page message",
      html: html_body
    };
    sgMail.send(msg);

    return res.json({
        status:"Success",
        message:"Message send successfully"
    });
});

module.exports = router;