const db = require("../../db/mongodb");
const express = require("express");
const config = require("config");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
var Mailchimp = require("mailchimp-api-v3");
var mailchimp = new Mailchimp(config.mailchimp_api_key);

const Property = require("../../db/models/properties");
const Booking = require("../../db/models/bookings");
const Slot = require("../../db/models/slots");
const City = require("../../db/models/cities");
const Price = require("../../db/models/pricing");
const Room = require("../../db/models/rooms");
const UserRating = require("../../db/models/userratings");
const BookLog = require("../../db/models/bookinglogs");

const _ = require("underscore");
const moment = require("moment");
const geodist = require("geodist");

const router = express.Router();
router.post("/register", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  var logo =
    req.protocol +
    "://" +
    req.get("host") +
    "/public/img/StayhopperLogoRedWHite.png";
  let msg = {
    to: config.website_admin_email,
    bcc: [{ email: "ewaantech.projects@gmail.com" }],
    from: config.website_admin_from_email,
    subject: "STAYHOPPER: New property created from website",
    text: "New property created from website, see details below:",
    html:
      `<html>
    <body>
        <div style="background-color:#eee">
            <div style="background-color:#eee">
                <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%">
                        <tbody>
                            <tr>
                                <td style="direction:ltr;font-size:0px;padding:10px 10px 10px 0px;text-align:center;vertical-align:top;border-bottom: 3px solid green;background-color: #082d70;">
                                    <div class="m_-4298688629919949047mj-column-per-100 m_-4298688629919949047outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%">
                                        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%">
                                            <tbody><tr>
                                                    <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                        <table align="left" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px">
                                                            <tbody>
                                                                <tr>
                                                                    <td style="font-family:Helvetica,Arial,sans-serif;font-size: 30px;font-weight: bold;line-height:24px;text-align:left;color:#4c4c4c;">
                                                                        <img src='` +
      logo +
      `' style="width:220px;">
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </tbody></table>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%">
                        <tbody>
                            <tr>
                                <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top">
                                    <div class="m_-4298688629919949047mj-column-per-100 m_-4298688629919949047outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%">
                                        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%">
                                            <tbody><tr>
                                                    <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                        <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#4c4c4c">
                                                            Hello <span style="color: green;">StayhopperAdmin</span>,<br><br>New property created from website, see details below:<br></div>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                        <table border="0" style="color:#000;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;table-layout:auto;width:100%">
                                                            <tbody>
                                                                <tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">Name</th>
                                                                    <th style="padding:0 15px">` +
      req.body.name +
      `</th>
                                                                </tr>
                                                                <tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">Email</th>
                                                                    <th style="padding:0 15px">` +
      req.body.email_address +
      `</th>
                                                                </tr>
								<tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">Phone</th>
                                                                    <th style="padding:0 15px">` +
      req.body.phone_number +
      `</th>
                                                                </tr>
								<tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">Hotel name</th>
                                                                    <th style="padding:0 15px">` +
      req.body.hotel_name +
      `</th>
                                                                </tr>
								<tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">City</th>
                                                                    <th style="padding:0 15px">` +
      req.body.city +
      `</th>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                        <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#4c4c4c">Regards,<br>Team Stayhoppers
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </body>
</html>`
  };
  sgMail.send(msg);

  msg = {
    to: req.body.email_address,
    bcc: [{ email: "ewaantech.projects@gmail.com" }],
    from: config.website_admin_from_email,
    subject: "STAYHOPPER: Thank you for registering property with us!",
    text:
      "Thank you for registering property with us. Property will be reviewed and up in the app soon!",
    html:
      `<html>
      <body>
          <div style="background-color:#eee">
              <div style="background-color:#eee">
                  <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px">
                      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%">
                          <tbody>
                              <tr>
                                  <td style="direction:ltr;font-size:0px;padding:10px 10px 10px 0px;text-align:center;vertical-align:top;border-bottom: 3px solid green;background-color: #082d70;">
                                      <div class="m_-4298688629919949047mj-column-per-100 m_-4298688629919949047outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%">
                                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%">
                                              <tbody><tr>
                                                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                          <table align="left" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px">
                                                              <tbody>
                                                                  <tr>
                                                                      <td style="font-family:Helvetica,Arial,sans-serif;font-size: 30px;font-weight: bold;line-height:24px;text-align:left;color:#4c4c4c;">
                                                                          <img src='` +
      logo +
      `' style="width:220px;">
                                                                      </td>
                                                                  </tr>
                                                              </tbody>
                                                          </table>
                                                      </td>
                                                  </tr>
                                              </tbody></table>
                                      </div>
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
                  <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px">
                      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%">
                          <tbody>
                              <tr>
                                  <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top">
                                      <div class="m_-4298688629919949047mj-column-per-100 m_-4298688629919949047outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%">
                                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%">
                                              <tbody><tr>
                                                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                            <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#4c4c4c">
                                                              Hello <span style="color: green;">` +
      req.body.name +
      `</span>,<br><br>Thank you for registering property with us. Property will be reviewed and up in the app soon!<br></div>
                                                      </td>
                                                  </tr>
                                                  <tr>
                                                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                          <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#4c4c4c">Regards,<br>Team Stayhoppers
                                                          </div>
                                                      </td>
                                                  </tr>
                                              </tbody>
                                          </table>
                                      </div>
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </body>
  </html>`
  };
  sgMail.send(msg);

  return res.json({
    status: 1,
    message:
      "Thank you for registering property with us. Property will be reviewed and up in the app soon!"
  });
});

router.post("/contact", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  var logo =
    req.protocol +
    "://" +
    req.get("host") +
    "/public/img/StayhopperLogoRedWHite.png";
  let msg = {
    to: config.website_admin_email,
    bcc: [{ email: "ewaantech.projects@gmail.com" }],
    from: config.website_admin_from_email,
    subject: "STAYHOPPER: Contact form enquiry from website",
    text: "Contact form enquiry from website, see details below:",
    html:
      `<html>
    <body>
        <div style="background-color:#eee">
            <div style="background-color:#eee">
                <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%">
                        <tbody>
                            <tr>
                                <td style="direction:ltr;font-size:0px;padding:10px 10px 10px 0px;text-align:center;vertical-align:top;border-bottom: 3px solid green;background-color: #082d70;">
                                    <div class="m_-4298688629919949047mj-column-per-100 m_-4298688629919949047outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%">
                                        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%">
                                            <tbody><tr>
                                                    <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                        <table align="left" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px">
                                                            <tbody>
                                                                <tr>
                                                                    <td style="font-family:Helvetica,Arial,sans-serif;font-size: 30px;font-weight: bold;line-height:24px;text-align:left;color:#4c4c4c;">
                                                                        <img src='` +
      logo +
      `' style="width:220px;">
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </tbody></table>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%">
                        <tbody>
                            <tr>
                                <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top">
                                    <div class="m_-4298688629919949047mj-column-per-100 m_-4298688629919949047outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%">
                                        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%">
                                            <tbody><tr>
                                                    <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                        <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#4c4c4c">
                                                            Hello <span style="color: green;">StayhopperAdmin</span>,<br><br>Contact form enquiry from website, see details below<br></div>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                        <table border="0" style="color:#000;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;table-layout:auto;width:100%">
                                                            <tbody>
                                                                <tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">Name</th>
                                                                    <th style="padding:0 15px">` +
      req.body.name +
      `</th>
                                                                </tr>
                                                                <tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">Email</th>
                                                                    <th style="padding:0 15px">` +
      req.body.email_address +
      `</th>
                                                                </tr>
								<tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">Phone</th>
                                                                    <th style="padding:0 15px">` +
      req.body.phone_number +
      `</th>
                                                                </tr>
								<tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">Address</th>
                                                                    <th style="padding:0 15px">` +
      req.body.address +
      `</th>
                                                                </tr>
								<tr style="border-bottom:1px solid #ecedee;text-align:left;padding:15px 0">
                                                                    <th style="padding:0 25px 0 0" width="80px">Message</th>
                                                                    <th style="padding:0 15px">` +
      req.body.message +
      `</th>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                        <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#4c4c4c">Regards,<br>Team Stayhoppers
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </body>
</html>`
  };
  sgMail.send(msg);

  msg = {
    to: req.body.email_address,
    bcc: [{ email: "ewaantech.projects@gmail.com" }],
    from: config.website_admin_from_email,
    subject: "STAYHOPPER: Thank you for contacting us!",
    text:
      "Thank you for contacting us. Our represantative will get back to you soon.",
    html:
      `<html>
      <body>
          <div style="background-color:#eee">
              <div style="background-color:#eee">
                  <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px">
                      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%">
                          <tbody>
                              <tr>
                                  <td style="direction:ltr;font-size:0px;padding:10px 10px 10px 0px;text-align:center;vertical-align:top;border-bottom: 3px solid green;background-color: #082d70;">
                                      <div class="m_-4298688629919949047mj-column-per-100 m_-4298688629919949047outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%">
                                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%">
                                              <tbody><tr>
                                                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                          <table align="left" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px">
                                                              <tbody>
                                                                  <tr>
                                                                      <td style="font-family:Helvetica,Arial,sans-serif;font-size: 30px;font-weight: bold;line-height:24px;text-align:left;color:#4c4c4c;">
                                                                          <img src='` +
      logo +
      `' style="width:220px;">
                                                                      </td>
                                                                  </tr>
                                                              </tbody>
                                                          </table>
                                                      </td>
                                                  </tr>
                                              </tbody></table>
                                      </div>
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
                  <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px">
                      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%">
                          <tbody>
                              <tr>
                                  <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top">
                                      <div class="m_-4298688629919949047mj-column-per-100 m_-4298688629919949047outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%">
                                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%">
                                              <tbody><tr>
                                                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                          <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#4c4c4c">
                                                              Hello <span style="color: green;">` +
      req.body.name +
      `</span>,<br><br>Thank you for contacting us. Our team will get back to you soon.<br></div>
                                                      </td>
                                                  </tr>
                                                  <tr>
                                                      <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word">
                                                          <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#4c4c4c">Regards,<br>Team Stayhoppers
                                                          </div>
                                                      </td>
                                                  </tr>
                                              </tbody>
                                          </table>
                                      </div>
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </body>
  </html>`
  };
  sgMail.send(msg);
  return res.json({
    status: 1,
    message: "Thank you for contacting us. Our team will get back to you soon."
  });
});
router.post("/subscribe", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  await mailchimp
    .post("/lists/" + config.mailchimp_admin_list_id, {
      members: [
        {
          email_address: req.body.email_address,
          status: "subscribed"
        }
      ]
    })
    .then(function(result) {
      if (result.errors.length > 0) {
        if (result.errors[0].error == "Please provide a valid email address.")
          return res.json({
            status: 0,
            message: "Please provide a valid email address."
          });
        else
          return res.json({
            status: 0,
            message:
              result.errors[0].email_address + " is already exists in our list"
          });
      } else {
        return res.json({
          status: 1,
          message:
            "Your newsletter subscription has been confirmed. You've been added to our list and will hear from us soon."
        });
      }
    })
    .catch(function(err) {
      console.log(err);
      return res.json({
        status: 0,
        message: "Could not add to news letter, Please check later"
      });
    });
});

router.get("/propertysearch", async (req, res) => {});

router.get("/cities", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  let cities = await City.find({}).sort({name:1});
  return res.json({ status: 1, data: { cities } });
});
router.get("/slots", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );

  let date = req.query.date;
  const selected_date = moment(date).format('YYYY-MM-DD');

  const start = moment();
  const remainder = 30 - (start.minute() % 30);
  const dateTime = moment(start).add(remainder, "minutes");
  const today = moment().format("YYYY-MM-DD").toString(); 
  let slot = moment(dateTime).format("HH:mm");
  let timeslots = [
    "00:00",
    "00:30",
    "01:00",
    "01:30",
    "02:00",
    "02:30",
    "03:00",
    "03:30",
    "04:00",
    "04:30",
    "05:00",
    "05:30",
    "06:00",
    "06:30",
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
    "22:00",
    "22:30",
    "23:00",
    "23:30"
  ];
  
  if(selected_date == moment().format('YYYY-MM-DD')){
    let firstIndex = timeslots.indexOf(slot, 0);
    requested_slots = timeslots.slice(
        firstIndex,
        timeslots.length
    );
  }else{
    requested_slots= timeslots;
  }
  return res.json({status:1, data:requested_slots, next_slot:slot})
});

//1. Search =========================================================================
router.post("/search", async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    let number_adults = req.body.number_adults;
    let selected_hours = req.body.selected_hours;
    let checkin_time = req.body.checkin_time;
    let checkin_date = req.body.checkin_date;
    checkin_date = moment(checkin_date).format('YYYY-MM-DD');
    let city = req.body.city;
    let number_rooms = req.body.number_rooms;
    let filter_service = [];
    if(req.body.service)
      filter_service = req.body.service.split(',');
    let filter_rating = [];
    if(req.body.rating)
      filter_rating = req.body.rating.split(',');  
    for(var i=0;i<filter_rating.length;i++){
      filter_rating[i] = db.Types.ObjectId(filter_rating[i]);
    }  
    // let filter_rating = req.body.rating;
    let filter_price = req.body.price;
    let sort = parseInt(req.body.sort_rating);
    let sort_popular = 0;
    let sort_rating = 0;
    let sort_price = 0;
    switch(sort){
      case 1:
        sort_popular = 1;
        break;
      case 2:
        sort_rating = 1;
        break; 
      case 3:
        sort_price = 1;
        break; 
      default:
        sort_popular = 1;   
    }
    let lat = 0;
    let lng = 0;
    if (req.body.location) {
      let tmp_loc = req.body.location.split(",");
      lat = tmp_loc[0];
      lng = tmp_loc[1];
    }
    let number_slots_required = selected_hours * 2 + 1;
    let slots = await Slot.find();
    let timeslots = [
      "00:00",
      "00:30",
      "01:00",
      "01:30",
      "02:00",
      "02:30",
      "03:00",
      "03:30",
      "04:00",
      "04:30",
      "05:00",
      "05:30",
      "06:00",
      "06:30",
      "07:00",
      "07:30",
      "08:00",
      "08:30",
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
      "17:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
      "22:00",
      "22:30",
      "23:00",
      "23:30"
    ];
    let slosts_array = [];
    for (let i = 0; i < slots.length; i++) {
      slosts_array.push(slots[i]._id);
    }
    let firstIndex = timeslots.indexOf(checkin_time, 0);
    let requested_slots = [];
    requested_slots1 = slosts_array.slice(
      firstIndex,
      firstIndex + number_slots_required
    );
    requested_slots.push({
      slots: requested_slots1,
      date: checkin_date
    });
    if (number_slots_required > requested_slots1.length) {
      // console.log({number_slots_required,slots1:requested_slots1.length});
      number_slots_required = number_slots_required - requested_slots1.length;
      requested_slots2 = slosts_array.slice(0, number_slots_required);
      let date2 = moment(checkin_date)
        .add(1, "days")
        .format("YYYY-MM-DD");
      requested_slots.push({
        slots: requested_slots2,
        date: date2
      });
      if (requested_slots2 < number_slots_required) {
        // console.log({number_slots_required,slots2:requested_slots2.length});
        number_slots_required = number_slots_required - requested_slots.length;
        requested_slots3 = slosts_array.slice(0, number_slots_required);
        let date3 = moment(date2)
          .add(1, "days")
          .format("YYYY-MM-DD");
        requested_slots.push({
          slots: requested_slots3,
          date: date3
        });
      }
    }
  
    booklogfilter = [];
    for (var i = 0; i < requested_slots.length; i++) {
      booklogfilter.push({
        $and: [
          { slot: { $in: requested_slots[i].slots } },
          { date: requested_slots[i].date }
        ]
      });
    }
  
    let lastslot_array = requested_slots[requested_slots.length - 1];
    let last_slot = lastslot_array.slots[lastslot_array.slots.length - 1];
    let last_slot_index = slosts_array.indexOf(last_slot, 0);
    last_slot_index = +last_slot_index + +1;
    let last_day = lastslot_array.date;
    let next_Day = moment(last_day)
      .add(1, "days")
      .format("YYYY-MM-DD");
    let tmpFilter = [];
    let extraslot_filter = [];
  
    //1
    let extraslotarray1 = [];
    let extraslot1 = [];
    let extraslot2 = [];
    extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 1);
    if (extraslot1.length > 0) {
      extraslotarray1.push({
        slots: extraslot1,
        date: last_day
      });
    }
    if (1 > extraslot1.length) {
      number_slots_required = 1 - extraslot1.length;
      extraslot2 = slosts_array.slice(0, number_slots_required);
      extraslotarray1.push({
        slots: extraslot2,
        date: next_Day
      });
    }
  
    for (var i = 0; i < extraslotarray1.length; i++) {
      booklogfilter.push({
        $and: [
          { slot: { $in: extraslotarray1[i].slots } },
          { date: extraslotarray1[i].date },
          { extraslots: 1 }
        ]
      });
    }
  
    //2
    let extraslotarray2 = [];
    extraslot1 = [];
    extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 2);
    if (extraslot1.length > 0) {
      extraslotarray2.push({
        slots: extraslot1,
        date: last_day
      });
    }
    if (2 > extraslot1.length) {
      number_slots_required = 2 - extraslot1.length;
      extraslot2 = slosts_array.slice(0, number_slots_required);
      extraslotarray2.push({
        slots: extraslot2,
        date: next_Day
      });
    }
  
    for (var i = 0; i < extraslotarray2.length; i++) {
      booklogfilter.push({
        $and: [
          { slot: { $in: extraslotarray2[i].slots } },
          { date: extraslotarray2[i].date },
          { extraslots: 2 }
        ]
      });
    }
  
    //3
    let extraslotarray3 = [];
    extraslot1 = [];
    extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 3);
    if (extraslot1.length > 0) {
      extraslotarray3.push({
        slots: extraslot1,
        date: last_day
      });
    }
    if (3 > extraslot1.length) {
      number_slots_required = 3 - extraslot1.length;
      extraslot2 = slosts_array.slice(0, number_slots_required);
      extraslotarray3.push({
        slots: extraslot2,
        date: next_Day
      });
    }
  
    for (var i = 0; i < extraslotarray3.length; i++) {
      booklogfilter.push({
        $and: [
          { slot: { $in: extraslotarray3[i].slots } },
          { date: extraslotarray3[i].date },
          { extraslots: 3 }
        ]
      });
    }
  
    //4
    let extraslotarray4 = [];
    extraslot1 = [];
    extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 4);
    if (extraslot1.length > 0) {
      extraslotarray4.push({
        slots: extraslot1,
        date: last_day
      });
    }
    if (4 > extraslot1.length) {
      number_slots_required = 4 - extraslot1.length;
      extraslot2 = slosts_array.slice(0, number_slots_required);
      extraslotarray4.push({
        slots: extraslot2,
        date: next_Day
      });
    }
  
    for (var i = 0; i < extraslotarray4.length; i++) {
      booklogfilter.push({
        $and: [
          { slot: { $in: extraslotarray4[i].slots } },
          { date: extraslotarray4[i].date },
          { extraslots: 4 }
        ]
      });
    }
  
    //5
    let extraslotarray5 = [];
    extraslot1 = [];
    extraslot1 = slosts_array.slice(last_slot_index, last_slot_index + 5);
    if (extraslot1.length > 0) {
      extraslotarray5.push({
        slots: extraslot1,
        date: last_day
      });
    }
    if (5 > extraslot1.length) {
      number_slots_required = 5 - extraslot1.length;
      extraslot2 = slosts_array.slice(0, number_slots_required);
      extraslotarray5.push({
        slots: extraslot2,
        date: next_Day
      });
    }
    for (var i = 0; i < extraslotarray5.length; i++) {
      booklogfilter.push({
        $and: [
          { slot: { $in: extraslotarray5[i].slots } },
          { date: extraslotarray5[i].date },
          { extraslots: 5 }
        ]
      });
    }
  
    console.log('booklogfilter', JSON.stringify(booklogfilter));
    //bookinglog
    let bookingLogMasterFilter = [
      {
        $lookup: {
          from: "rooms",
          localField: "room",
          foreignField: "_id",
          as: "room_details"
        }
      },
      {
        $addFields: {
          extraslots: { $arrayElemAt: ["$room_details.extraslot_cleaning", 0] }
        }
      },
      {
        $match: {
          $or: booklogfilter
        }
      },
      {
        $group: {
          _id: {
            property: "$property",
            room: "$room"
          },
          number: { $addToSet: "$number" }
        }
      },
      {
        $lookup: {
          from: "rooms",
          localField: "_id.room",
          foreignField: "_id",
          as: "room_details"
        }
      },
      {
        $addFields: {
          blockedrooms: { $size: "$number" },
          total_rooms: { $arrayElemAt: ["$room_details.number_rooms", 0] },
          extraslots: { $arrayElemAt: ["$room_details.extraslot_cleaning", 0] }
        }
      },
      {
        $addFields: {
          balance_rooms: { $subtract: ["$total_rooms", "$blockedrooms"] }
        }
      },
      {
        $group: {
          _id: {
            room: "$_id.room"
          },
          blockedrooms: { $sum: "$blockedrooms" }
        }
      }
    ];
  
    let blocked_properties_result = await BookLog.aggregate(
      bookingLogMasterFilter
    );
  
  
    console.log('blocked_properties_result', blocked_properties_result);
    let blocked_properties_array = [];
    for (var i = 0; i < blocked_properties_result.length; i++) {
      blocked_properties_array.push({
        room: blocked_properties_result[i]._id.room,
        blockedrooms: blocked_properties_result[i].blockedrooms
      });
    }
    console.log('blocked_properties_array', blocked_properties_array.length);

    custom_pricings_raw = await Price.aggregate([
      {
        $match: {
          from: {
            $lte:new Date(checkin_date+" 00:00:00.000")
          },
          to: {
            $gte:new Date(checkin_date+" 00:00:00.000")
          }
        }
      },
      { 
        $sort : { 
          _id : -1
        } 
      },
      {
        $group : {
           _id : { room:'$room'},
           h3: {$addToSet:'$h3'},
           h6: {$addToSet:'$h6'},
           h12: {$addToSet:'$h12'},
           h24: {$addToSet:'$h24'},
        }
      },
      {
        $project:{
          room : '$_id.room',
          h3: { $arrayElemAt: [ "$h3", 0 ] },
          h6: { $arrayElemAt: [ "$h6", 0 ] },
          h12: { $arrayElemAt: [ "$h12", 0 ] },
          h24: { $arrayElemAt: [ "$h24", 0 ] }
        }
      }
    ]);
   
    custom_pricings = [];
    if(custom_pricings_raw.length > 0){
      for(var i=0;i<custom_pricings_raw.length;i++){
        let cust_price = 0;
        switch(selected_hours){
          case '3':
          cust_price = custom_pricings_raw[i].h3;
            break;
          case '6':
          cust_price = custom_pricings_raw[i].h6;
            break;
          case '12':
          cust_price = custom_pricings_raw[i].h12;
            break;
          case '24':
          cust_price = custom_pricings_raw[i].h24;
            break;
        }
        if(parseFloat(cust_price) > 0){
          custom_pricings.push(
            {
              room : custom_pricings_raw[i].room,
              price : parseFloat(cust_price)
            }
          );  
        }
      }
    }
  
    let available_properties_filter = [];
    if (city) {
      available_properties_filter.push(
        {
          $match: {
            "contactinfo.city": db.Types.ObjectId(city.trim())
          }
        }
      )
    } else {
      available_properties_filter.push(
        {  
          $geoNear: {
           near: { type: "Point", coordinates: [parseFloat(lng),parseFloat(lat)] },
           key: "location",
           spherical: true,
           distanceMultiplier: 0.001,
           distanceField: "distance"
          }
        },
        {
          $match: {
            "distance": {$lte:40}
          }
        }
      );
    }
    available_properties_filter.push(
      {
        $match: {
          "approved": true
        }
      },
      //match published
      {
        $match: {
          "published": true
        }
      },
      {
        $addFields: {
          timeslot_exists: {
            $in: [parseInt(selected_hours), "$timeslots"]
          }
        }
      },
      {
        $match: {
          timeslot_exists: true
        }
      },
      {
        $lookup: {
          from: "rooms",
          localField: "rooms",
          foreignField: "_id",
          as: "room_details"
        }
      },
      {
        $lookup: {
          from: "property_ratings",
          localField: "rating",
          foreignField: "_id",
          as: "rating"
        }
      }
    );
    let service_exists_filter = true
    if(filter_service.length > 0){
      service_exists_filter = {};
      service_exists_filter['$or'] = [];
      for(var i=0;i<filter_service.length;i++){
        service_exists_filter['$or'].push(
          {
            $in: [db.Types.ObjectId(filter_service[i]), "$services"]
          }
        )
      }
    }
    available_properties_filter.push(
      {
        $unwind: '$room_details'
      },
      { 
        $addFields: {
          services: {
           $cond: {
              if: {
                $ne: [ { "$type": "$room_details.services" }, "array" ]
              },
              "then": [],
              "else": "$room_details.services"
           }
          }
        }
      },
      {
        $project:
        {
          name: '$name',
          images: '$images',
          rating: '$rating',
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          room_id: '$room_details._id',
          number_rooms: '$room_details.number_rooms',
          room_detail: '$room_details',
          distance : '$distance',
          location : '$contactinfo.location',
          latlng : '$contactinfo.latlng',
          service_exists: service_exists_filter,
          blocked_properties_array: blocked_properties_array
        }
      },
    );
    if(filter_service.length > 0){
      available_properties_filter.push(  
        {
          $match:{
            service_exists: true
          }
        }
      );
    }
    available_properties_filter.push(  
      { 
        $project: 
        { 
          name: '$name',
          images: '$images',
          rating: '$rating',
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          room_id : '$room_id',
          number_rooms : '$number_rooms',
          room_detail:'$room_detail',
          distance : '$distance',
          location : '$location',
          latlng : '$latlng',
          blocked_properties_array: {
            '$filter': {
              input: '$blocked_properties_array',
              as: 'blocked_properties_array',
              cond: { $eq: ['$$blocked_properties_array.room', '$room_id'] }
           }
          }
        } 
      },
      {
        $addFields: {
          blockedrooms: { $arrayElemAt: ["$blocked_properties_array.blockedrooms", 0] },
          custom_pricings_array : custom_pricings
        }
      },
      { 
        $project: 
        { 
          name: '$name',
          images: '$images',
          rating: '$rating',
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          room_id : '$room_id',
          number_rooms : '$number_rooms',
          room_detail:'$room_detail',
          distance : '$distance',
          location : '$location',
          latlng : '$latlng',
          blockedrooms: {
            $ifNull: [ "$blockedrooms",0]
          },
          custom_pricings_array : {
            '$filter': {
              input: '$custom_pricings_array',
              as: 'custom_pricings_array',
              cond: { $eq: ['$$custom_pricings_array.room', '$room_id'] }
            }
          }
        } 
      },
      {
        $addFields: {
          available_rooms: { $subtract: ["$number_rooms","$blockedrooms"] },
          default_price: '$room_detail.price.h'+selected_hours,
          custom_pricing : { $arrayElemAt: ["$custom_pricings_array", 0] },
        }
      },
      {
        $match:{
          available_rooms: {$ne:0}
        }
      },
      { 
        $project: 
        { 
          name: '$name',
          images: '$images',
          rating: { $arrayElemAt: ["$rating", 0] },
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          room_id : '$room_id',
          number_rooms : '$number_rooms',
          room_detail:'$room_detail',
          distance : '$distance',
          blockedrooms: "$blockedrooms",
          available_rooms : "$available_rooms",
          default_price: '$default_price',
          custom_price:"$custom_pricing.price",
          location : '$location',
          latlng : '$latlng',
        } 
      },
      { 
        $addFields:{
          current_price: { $ifNull: [ "$custom_price", "$default_price" ] }
        } 
      },
      {
        $match:{
          current_price:{$gte:0}
        }
      }
    )
    if(filter_price){
      filter_price = filter_price.split(',');
      from = parseFloat(filter_price[0]);
      to = parseFloat(filter_price[1]);
      available_properties_filter.push(
        {
          $match:{
            current_price: { $gte : from, $lte: to}
          }
        }
      )
    }
    if(parseInt(number_rooms) == 1){
      available_properties_filter.push(
        {
          $match:{
            'room_detail.number_guests': {$gte: parseInt(number_adults)}
          }
        }
      );
    }
    available_properties_filter.push(
      {
        $project:{ 
          name: '$name',
          images: '$images',
          rating: "$rating",
          timeslots: '$timeslots',
          user_rating: '$user_rating',
          distance : '$distance',
          rooms:{
            _id:'$room_id',
            price:'$default_price',
            custom_price:'$custom_price',
            available_rooms:'$available_rooms',
            blocked_rooms:'$blockedrooms',
            current_price: '$current_price'
          },
          contactinfo:{
            location : '$location',
            latlng:'$latlng'
          }
        } 
      },
      {
        $sort:{
          'rooms.current_price':-1
        }
      }
    );
    available_properties_filter.push(
      {
        $group : {
          _id:{property:'$_id'},
          name: {$addToSet:'$name'},
          images: {$addToSet:'$images'},
          rating: {$addToSet:'$rating'},
          timeslots: {$addToSet:'$timeslots'},
          user_rating: {$addToSet:'$user_rating'},
          distance : {$addToSet:'$distance'},
          rooms:{$addToSet:'$rooms'},
          contactinfo: {$addToSet:'$contactinfo'},
          minprice: { $min: "$rooms.current_price" },
          maxprice: { $max: "$rooms.current_price" },
          available_rooms: {$sum:'$rooms.available_rooms'}
        }
      },
      {
        $project : {
          _id:'$_id.property',
          name: { $arrayElemAt: ["$name", 0] },
          images: { $arrayElemAt: ["$images", 0] },
          rating: { $arrayElemAt: ["$rating", 0] },
          timeslots: { $arrayElemAt: ["$timeslots", 0] },
          user_rating: { $arrayElemAt: ["$user_rating", 0] },
          distance : { $arrayElemAt: ["$distance", 0] },
          rooms: '$rooms',
          contactinfo: { $arrayElemAt: ["$contactinfo", 0] },
          minprice: "$minprice",
          maxprice: "$maxprice",
          available_rooms: "$available_rooms"
        }
      },
      {
        $match:{
          available_rooms:{$gte: parseInt(number_rooms)}
        }
      }
    );
    if(filter_rating.length > 0){
      available_properties_filter.push(
        {
          $match:{
            'rating._id':{
              $in:filter_rating
            }
          }
        }
      );
    }
    // for(var i=0;i<filter_rating.length;i++){
      // available_properties_filter.push(
      //   {
      //     $match:{
      //       'rating._id':filter_rating[i]
      //     }
      //   }
      // );
    // }
    if(sort_rating){
      available_properties_filter.push(
        {
          $sort:{
            'rating.value': -1
          }
        }
      )
    }
    if(sort_popular){
      available_properties_filter.push(
        {
          $sort:{
            user_rating: -1
          }
        }
      )
    }
    if(sort_price){
      available_properties_filter.push(
        {
          $sort:{
            minprice: 1
          }
        }
      )
    }
    let available_properties = await Property.aggregate(available_properties_filter);
    if (available_properties.length > 0) {
      return res.json({ status: "Success", data: available_properties });
    } else {
      return res.json({ status: "Failed", message: "No data" });
    }
  });
module.exports = router;
