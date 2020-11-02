const db = require("mongoose");
const cron = require("node-cron");
const config = require("config");
const UserBooking = require("./db/models/userbookings");
const Invoice = require("./db/models/invoices");
const CompletedBooking = require("./db/models/completedbookings");
const moment = require("moment");
const Property = require("./db/models/properties");
const _ = require("underscore");

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.sendgrid_api);
const fs = require("fs");

let invoicesCtrl = {
  generateInvoices: async (invoiceForDate) => {
    console.log('GENERATE INVOICES: START');

    // DEBUG:START
    // const deleteInvoices = await Invoice.remove({});
    // console.log(`-- Deleted existing invoices...`, deleteInvoices);
    // console.log(`--`);
    // DEBUG:END

    // 1. Get Properties
    const properties = await Property.find({}).populate([{path: "rooms"},{path: "contactinfo.country"}]);

    // 2. If no date provided, set the invoice date
    if (!invoiceForDate) {
      // Get Today's date (Should be 1st of a month)
      // const todayUtcDateMoment = moment.utc(new Date('2020-03-01')); // Debug
      const todayUtcDateMoment = moment.utc(new Date());

      // Get the previous month for billing
      const invoiceForDateMoment = moment(todayUtcDateMoment).subtract(1, 'month').startOf('month');
      invoiceForDate = invoiceForDateMoment.toDate();
      // console.log('invoiceForDate', invoiceForDate);
    }

    // 3. Generate Invoices for all properties for the month/year as per invoiceForDate
    let invoices = await Promise.all(
      properties
        // DEBUG: Uncomment below line to limit only to DARUS HOTEL as test property
        // .filter(property => property._id.toString() === '5def593b13234106c605b1d7')
        // DEBUG: Uncomment below line to limit only to Chelsea Plaza Hotel as test property
        // .filter(property => property._id.toString() === '5c3edabdcfdc5b72e21f5435')
        .map(async property => await invoicesCtrl.generateInvoiceForProperty(property._id, invoiceForDate))
    );

    // Remove invoices that are not generated (due to amount being 0 / no bookings)
    invoices = invoices.filter(invoice => !!invoice)

    // 4. Send Invoices for all properties to
    // Super Admin
    // Property

    // Admin receives 1 combined email
    const shouldSendCombinedEmailToAdmin = true;
    if (shouldSendCombinedEmailToAdmin) {
      const communicateCombinedEmailForSuperadmin = await invoicesCtrl.sendCombinedEmailToAdmin(invoices.filter(invoice => !!invoice.amount));
    }

    // Property - Each Property receives separate invoice email
    // Super Admin - If combined email sent, don't send individual emails, otherwise each property's invoice is sent to Super Admin
    const communicateEmails = await Promise.all(invoices
      .filter(invoice => !!invoice.amount)
      .map(invoice => invoicesCtrl.sendInvoices(invoice, !shouldSendCombinedEmailToAdmin))
    );
    console.log('GENERATE INVOICES: END');
    return true;
  },

  generateInvoiceForProperty: async (propertyId, invoiceForDate) => {

    // Invoice Month should be June
    const invoiceGenerationDateMoment = moment.utc(new Date());
    const invoiceForDateMoment = moment(invoiceForDate);
    const startDateMoment = moment(invoiceForDateMoment).startOf('month');
    const endDateMoment = moment(invoiceForDateMoment).endOf('month');

    const property = await Property
      .findOne({_id: propertyId})
      .populate([
        {
          path: "currency"
        },
        {
          path: "payment.country"
        }
      ])
    ;

    if (!property) {
      console.log('Property not found, so could not generate invoice')
      return;
    }

    console.log(`1. Generating invoice for ${property.name.trim()} for ${startDateMoment.format("MMMM YYYY")}`);

    let amount = 0;
    let amountFromProperty = 0;
    let amountToProperty = 0;
    let totalBookingsCount = 0;
    let userBookingsIds = [];
    let completedBookingsIds = [];
    let bookingFeeForProperty = 0;
    if (
      property.contactinfo &&
      property.contactinfo.country &&
      property.contactinfo.country._id &&
      property.currency
    ) {
      const bookingFeesForCountry = config.bookingFee[property.contactinfo.country._id];
      const bookingFeeForCurrency = bookingFeesForCountry.find(bf => bf.currency === property.currency._id.toString());
      if (bookingFeeForCurrency) {
        bookingFeeForProperty = bookingFeeForCurrency.fee;
      }
    }

    // console.log('bookingFeeForProperty', bookingFeeForProperty);

    // 1. User Bookings - get IDS and total amount
    const userBookingsAggregate = [
      {
        $match: {
          property: property._id,
          date_booked: {
            $gte: startDateMoment.toDate(),
            $lt: endDateMoment.toDate()
          },
          paid: true,
          cancel_approval: {$ne: 1}
        }
      }, {
        $project: {
          _id: 1,
          bookingType: 1,
          total_amt: 1
        }
      }, {
        $group: {
          _id: '$bookingType',
          bookingType: {$first: '$bookingType'},
          ids: {
            $push: '$_id'
          },
          total_amt: {
            $sum: '$total_amt'
          }
        }
      }
    ];

    // 2. Completed bookings - get IDS and total amount
    const completedBookingsAggregate = [
      {
        $match: {
          'propertyInfo.id': property._id,
          paid: true,
          date_booked: {
            $gte: startDateMoment.toDate(),
            $lt: endDateMoment.toDate()
          }
        }
      }, {
        $project: {
          _id: 1,
          date_booked: 1,
          userbookings: 1,
          propertyInfo: 1,
          bookingType: 1,
          ub_id: 1,
          total_amt: 1
        }
      }, {
        $group: {
          _id: '$bookingType',
          bookingType: {$first: '$bookingType'},
          ids: {
            $push: '$_id'
          },
          total_amt: {
            $sum: '$total_amt'
          }
        }
      }
    ];

    const ubBookingTypes = await UserBooking.aggregate(userBookingsAggregate);
    // console.log('userBookingsAggregate', userBookingsAggregate);
    // console.log('ubBookingTypes', ubBookingTypes);

    const cbBookingTypes = await CompletedBooking.aggregate(completedBookingsAggregate);
    // console.log('completedBookingsAggregate', completedBookingsAggregate);
    // console.log('cbBookingTypes', cbBookingTypes);

    let categorizedCommissions = {};

    // 3. calculate from results
    // 3.1 From User Bookings (active bookings)
    if (ubBookingTypes.length) {
      ubBookingTypes.map(ubBookingType => {
        userBookingsIds = userBookingsIds.concat(ubBookingType.ids);
        // amount += (ubBookingTypes[0].ids.length * bookingFeeForProperty);
        // If we have a commission defined for the specific booking type, calculate it
        // config.commission.hourly, and config.commission.monthly
        if (config.commission && config.commission[ubBookingType.bookingType]) {
          const commissionAmt = (ubBookingType.total_amt * (config.commission[ubBookingType.bookingType] / 100));
          amountFromProperty += commissionAmt;

          // Debug: for logging and comparing figures
          categorizedCommissions[ubBookingType.bookingType] = categorizedCommissions[ubBookingType.bookingType] || 0;
          categorizedCommissions[ubBookingType.bookingType] += commissionAmt;
        }

        // In case of hourly booking, we don't owe anything to the property
        if (ubBookingType.bookingType === 'hourly') {
          amountToProperty += 0;
        } else if (ubBookingType.bookingType === 'monthly') {
          // In case of monthly booking, we owe the full amount to the property as we are collecting the whole amount on their behalf
          amountToProperty += ubBookingType.total_amt;
        }
        totalBookingsCount += ubBookingType.ids.length;
      })
    }

    // 3.2 From Completed Bookings (completed bookings)
    if (cbBookingTypes.length) {
      cbBookingTypes.map(cbBookingType => { 
        completedBookingsIds = completedBookingsIds.concat(cbBookingType.ids);
        // amount += (cbBookingTypes[0].ids.length * bookingFeeForProperty);
        // If we have a commission defined for the specific booking type, calculate it
        // config.commission.hourly, and config.commission.monthly
        if (config.commission && config.commission[cbBookingType.bookingType]) {
          const commissionAmt = (cbBookingType.total_amt * (config.commission[cbBookingType.bookingType] / 100));
          amountFromProperty += commissionAmt;

          // Debug: for logging and comparing figures
          categorizedCommissions[cbBookingType.bookingType] = categorizedCommissions[cbBookingType.bookingType] || 0;
          categorizedCommissions[cbBookingType.bookingType] += commissionAmt;
        }

        // In case of hourly booking, we don't owe anything to the property
        if (cbBookingType.bookingType === 'hourly') {
          amountToProperty += 0;
        } else if (cbBookingType.bookingType === 'monthly') {
          // In case of monthly booking, we owe the full amount to the property as we are collecting the whole amount on their behalf
          amountToProperty += cbBookingType.total_amt;
        }
        totalBookingsCount += cbBookingType.ids.length;
      })
    }

    // Property owes us, we owe them
    // Get the balance of their owing to us (it may just be so that we have to pay them)
    amountFromProperty = parseFloat(amountFromProperty.toFixed(2));
    amountToProperty = parseFloat(amountToProperty.toFixed(2));
    amount = parseFloat((amountFromProperty - amountToProperty).toFixed(2));

    // console.log('userBookingsIds', userBookingsIds, 'totalBookingsCount', totalBookingsCount);
    // console.log('completedBookingsIds', completedBookingsIds, 'totalBookingsCount', totalBookingsCount);
    console.log('Amount from Property:', property.currency.code, amountFromProperty.toFixed(2), '. Breakdown:', categorizedCommissions);
    console.log('Amount to Property:', property.currency.code, amountToProperty.toFixed(2));
    console.log('Total Amount from Property:', property.currency.code, amount.toFixed(2));

    if (amount) {

      // Unique invoice number based on year-month-propertyID
      // If invoice exists for this date/property combination, keep appending '-{nexNumber}' (eg: '-1')
      let invoiceNo = ['SH', startDateMoment.format("YYYY-MM"), property._id].join('-');
      const existingInvoice = await Invoice.find({invoiceForDate: startDateMoment.format("YYYY-MM-DD")});
      if (existingInvoice && existingInvoice.length) {
        invoiceNo = [invoiceNo, existingInvoice.length].join('-');
      }
      const invoiceData = {
        invoiceNo,
        issueDate: invoiceGenerationDateMoment.toDate(),
        invoiceForDate: startDateMoment.format("YYYY-MM-DD"),
        invoiceForMonthString: startDateMoment.format("MMMM YYYY"),
        status: 'pending',
        // invoiceSentToSuperAdmin: false,
        invoiceSentToProperty: false,
        completedBookings: completedBookingsIds,
        commissionHourly: config.commission.hourly,
        commissionMonthly: config.commission.monthly,
        userBookings: userBookingsIds,
        paymentUrl: '',
        property: property._id,
        currency: property.currency,
        amountFromProperty,
        amountToProperty,
        amount,
        totalBookingsCount
      };

      const invoice = new Invoice(invoiceData);
      await invoice.save();
      await Invoice.populate(invoice, 'property currency completedBookings userBookings');
      console.log(`- Invoice Generated: ${invoice._id}. Amount ${invoice.currency.code} ${invoice.amount}. Bookings: ${invoice.userBookings.length + invoice.completedBookings.length}`);
      return invoice;
    } else {
      return null;
    }
  },

  sendInvoices: async (invoice, sendIndividualEmailToAdmin) => {
    const adminEmail = config.invoice_email;
    const propertyEmail = invoice.property && invoice.property.contactinfo && invoice.property.contactinfo.email;
    console.log(`2. Sending invoice ${invoice._id} for ${invoice.property.name}`);
    
    const invoiceMonthYear = invoice.invoiceForMonthString;
    const propertyName = invoice.property.name;
    const paymentUrl = invoice.paymentUrl;
    const paymentAmount = invoice.amount;
    const currency = invoice.currency.code;
    const invoiceUrl = `${config.extranet_url}app/invoices/${invoice._id}`;
    let isInvoiceUpdated = false;

    // Send invoice to the Admin (This way admin will receive all invoices as separate emails)
    // // Disable sending
    // if (false) {
    // Enable Sending
    if (sendIndividualEmailToAdmin && adminEmail) {
      let html_body = fs.readFileSync("public/invoice-emails/invoice-admin.html","utf8");
      html_body = html_body.replace(/\{\{INVOICE_MONTH\}\}/g, invoiceMonthYear);
      html_body = html_body.replace(/\{\{PROPERTY_NAME\}\}/g, propertyName);
      html_body = html_body.replace(/\{\{PAYMENT_URL\}\}/g, paymentUrl);
      html_body = html_body.replace(/\{\{CURRENCY\}\}/g, currency);
      html_body = html_body.replace(/\{\{PAYMENT_AMOUNT\}\}/g, paymentAmount);
      html_body = html_body.replace(/\{\{INVOICE_URL\}\}/g, invoiceUrl);

      // TODO: Enable Emails for production
      msg = {
        // NEW
        // to: adminEmail,
        // bcc: [
        //   { email: config.website_admin_bcc_email }
        // ],

        // TESTING
        to: 'rahul.vagadiya+invoice@gmail.com',
        bcc: [
          { email: adminEmail }
        ],

        from: {
          email: config.website_admin_from_email,
          name: config.fromname
        },
        subject: `STAYHOPPER: ${invoiceMonthYear} Invoice sent to property ${propertyName}`,
        text: `${invoiceMonthYear} Invoice sent to property ${propertyName}`,
        html: html_body
      };
      sgMail.send(msg);
      // invoice.invoiceSentToSuperAdmin = true;
      // isInvoiceUpdated = true;
      console.log(`2.1 Email sent To Admin @ '${adminEmail}'`);
    }

    // Send invoice to the property
    // // Disable sending
    // if (false) {
    // Enable Sending
    if (propertyEmail) {
      let html_body = fs.readFileSync("public/invoice-emails/invoice-property.html","utf8");
      html_body = html_body.replace(/\{\{INVOICE_MONTH\}\}/g, invoiceMonthYear);
      html_body = html_body.replace(/\{\{PROPERTY_NAME\}\}/g, propertyName);
      html_body = html_body.replace(/\{\{PAYMENT_URL\}\}/g, paymentUrl);
      html_body = html_body.replace(/\{\{CURRENCY\}\}/g, currency);
      html_body = html_body.replace(/\{\{PAYMENT_AMOUNT\}\}/g, paymentAmount);
      html_body = html_body.replace(/\{\{INVOICE_URL\}\}/g, invoiceUrl);

      // TODO: Enable Emails for production
      msg = {
        // NEW
        // to: propertyEmail,
        // bcc: [
        //   { email: adminEmail },
        //   { email: config.website_admin_bcc_email }
        // ],

        // TESTING
        to: 'rahul.vagadiya+invoiceproperty@gmail.com',
        bcc: [
          { email: adminEmail }
        ],
        from: {
          email: config.website_admin_from_email,
          name: config.fromname
        },
        subject: `STAYHOPPER: Your ${invoiceMonthYear} invoice is available`,
        text: `Your ${invoiceMonthYear} invoice is available`,
        html: html_body
      };
      sgMail.send(msg);
      invoice.invoiceSentToProperty = true;
      invoice.invoiceSentToPropertyDate = new Date();
      isInvoiceUpdated = true;
      console.log(`2.2 Email sent To Property @ '${propertyEmail}' (DEBUG: Sent to Admin only)`);
    }

    if (isInvoiceUpdated) {
      await invoice.save();
    }
  },

  sendCombinedEmailToAdmin: async (invoices) => {
    if (invoices.length) {
      const adminEmail = config.invoice_email;
      const invoiceMonthYear = invoices[0].invoiceForMonthString;
      const invoicesUrl = `${config.extranet_url}app/invoices`;

      // Enable Sending
      if (adminEmail) {
        let html_body = fs.readFileSync("public/invoice-emails/invoices-combined-admin.html","utf8");
        html_body = html_body.replace(/\{\{INVOICE_MONTH\}\}/g, invoiceMonthYear);
        html_body = html_body.replace(/\{\{INVOICES_URL\}\}/g, invoicesUrl);
        html_body = html_body.replace(/\{\{PROPERTIES_COUNT_STR\}\}/g, invoices.length === 1
          ? `${invoices.length} property`
          : `${invoices.length} properties`
        );

        // TODO: Enable Emails for production
        msg = {
          // NEW
          // to: adminEmail,
          // bcc: [
          //   { email: config.website_admin_bcc_email }
          // ],

          // TESTING
          to: 'rahul.vagadiya+invoice@gmail.com',
          bcc: [
            { email: adminEmail }
          ],
          from: {
            email: config.website_admin_from_email,
            name: config.fromname
          },
          subject: `STAYHOPPER: ${invoiceMonthYear} Invoice sent to ${invoices.length === 1
            ? invoices.length + ' property'
            : invoices.length + 'properties'}
          `,
          text: `${invoiceMonthYear} Invoice sent to ${invoices.length === 1
            ? invoices.length + ' property'
            : invoices.length + 'properties'}
          `,
          html: html_body
        };
        sgMail.send(msg);

        // await Invoice.updateMany(
        //   {
        //     _id: {$in: invoices.map(i => i._id)},
        //     amount: {$gt: 0}
        //   },
        //   {
        //     $set: {
        //       invoiceSentToSuperAdmin: true
        //     }
        //   }
        // );
        console.log(`2.1 Combined Email of ${invoices.length} invoices sent To Admin @ '${adminEmail}'`);
      }
    }
  },

  sendUnpaidInvoiceReminders: async() => {
    const adminEmail = config.invoice_email;
    const pendingInvoices = await Invoice
      .find({
        status: 'pending',
        amount: {$gt: 0}
      })
      .populate('property currency completedBookings userBookings')
    ;
    let propertiesRemindersSentIds = [];

    await Promise.all(
      pendingInvoices.map(async invoice => {
        const propertyEmail = invoice.property && invoice.property.contactinfo && invoice.property.contactinfo.email;
        const invoiceMonthYear = invoice.invoiceForMonthString;
        const propertyName = invoice.property.name;
        const paymentUrl = invoice.paymentUrl;
        const paymentAmount = invoice.amount;
        const currency = invoice.currency.code;
        const invoiceUrl = `${config.extranet_url}app/invoices/${invoice._id}`;

        // Send reminder to property for payment
        if (propertyEmail) {
          let html_body = fs.readFileSync("public/invoice-emails/invoice-reminder-property.html","utf8");
          html_body = html_body.replace(/\{\{INVOICE_MONTH\}\}/g, invoiceMonthYear);
          html_body = html_body.replace(/\{\{PROPERTY_NAME\}\}/g, propertyName);
          html_body = html_body.replace(/\{\{PAYMENT_URL\}\}/g, paymentUrl);
          html_body = html_body.replace(/\{\{CURRENCY\}\}/g, currency);
          html_body = html_body.replace(/\{\{PAYMENT_AMOUNT\}\}/g, paymentAmount);
          html_body = html_body.replace(/\{\{INVOICE_URL\}\}/g, invoiceUrl);

          // TODO: Enable Emails for production
          msg = {
            // NEW
            // to: propertyEmail,
            // bcc: [
            //   { email: adminEmail },
            //   { email: config.website_admin_bcc_email }
            // ],

            // TESTING
            to: 'rahul.vagadiya+invoiceproperty@gmail.com',
            bcc: [
              { email: adminEmail }
            ],
            from: {
              email: config.website_admin_from_email,
              name: config.fromname
            },
            subject: `STAYHOPPER: Outstanding balance for ${invoiceMonthYear} invoice`,
            text: `Outstanding balance for ${invoiceMonthYear} invoice`,
            html: html_body
          };
          sgMail.send(msg);
          invoice.reminderSentToProperty = true;
          invoice.reminderSentToPropertyDate = new Date();
          propertiesRemindersSentIds.push(invoice.property._id.toString());
          console.log(`1. Reminder to pay for invoice ${invoiceMonthYear} sent To Property @ '${propertyEmail}' (DEBUG: Sent to Admin only)`);
          return await invoice.save();
        }
        return invoice;
      })
    );

    // unique
    propertiesRemindersSentIds = [...new Set(propertiesRemindersSentIds)];

    // Send email to admin regarding reminders
    if (adminEmail && pendingInvoices.length) {
      const invoiceMonthYear = pendingInvoices[0].invoiceForMonthString;
      const invoicesUrl = `${config.extranet_url}app/invoices`;

      let html_body = fs.readFileSync("public/invoice-emails/invoice-reminder-admin.html","utf8");
      html_body = html_body.replace(/\{\{INVOICE_MONTH\}\}/g, invoiceMonthYear);
      html_body = html_body.replace(/\{\{PROPERTIES_COUNT_STR\}\}/g, pendingInvoices.length === 1
        ? `${pendingInvoices.length} property`
        : `${pendingInvoices.length} properties`
      );
      html_body = html_body.replace(/\{\{INVOICES_URL\}\}/g, invoicesUrl);

      // TODO: Enable Emails for production
      msg = {
        // NEW
        // to: adminEmail,
        // bcc: [
        //   { email: config.website_admin_bcc_email }
        // ],

        // TESTING
        to: 'rahul.vagadiya+invoice@gmail.com',
        bcc: [
          { email: adminEmail }
        ],
        from: {
          email: config.website_admin_from_email,
          name: config.fromname
        },
        subject: `STAYHOPPER: Reminder to pay for ${invoiceMonthYear} invoice sent to ${propertiesRemindersSentIds.length === 1
          ? propertiesRemindersSentIds.length + ' property'
          : propertiesRemindersSentIds.length + ' properties'}
        `,
        text: `Reminder to pay for ${invoiceMonthYear} invoice sent to ${propertiesRemindersSentIds.length === 1
          ? propertiesRemindersSentIds.length + ' property'
          : propertiesRemindersSentIds.length + ' properties'}
        `,
        html: html_body
      };
      sgMail.send(msg);
      console.log(`2. Reminders to pay for (${pendingInvoices.length}) ${invoiceMonthYear} invoices has been sent to ${propertiesRemindersSentIds.length === 1
        ? propertiesRemindersSentIds.length + ' property'
        : propertiesRemindersSentIds.length + ' properties'}`
      );
    }
  },

  deactivatePropertiesWithUnpaidInvoices: async() => {
    const adminEmail = config.invoice_email;
    const pendingInvoices = await Invoice
      .find({
        status: 'pending',
        amount: {$gt: 0}
      })
      .populate('property currency completedBookings userBookings')
    ;
    let propertiesDeactivatedIds = [];

    await Promise.all(
      pendingInvoices.map(async invoice => {
        const propertyEmail = invoice.property && invoice.property.contactinfo && invoice.property.contactinfo.email;
        const invoiceMonthYear = invoice.invoiceForMonthString;
        const propertyName = invoice.property.name;
        const paymentUrl = invoice.paymentUrl;
        const paymentAmount = invoice.amount;
        const currency = invoice.currency.code;
        const invoiceUrl = `${config.extranet_url}app/invoices/${invoice._id}`;

        // Deactivate property, and send notification to property
        if (propertyEmail) {
          let html_body = fs.readFileSync("public/invoice-emails/invoice-deactivate-property.html","utf8");
          html_body = html_body.replace(/\{\{INVOICE_MONTH\}\}/g, invoiceMonthYear);
          html_body = html_body.replace(/\{\{PROPERTY_NAME\}\}/g, propertyName);
          html_body = html_body.replace(/\{\{PAYMENT_URL\}\}/g, paymentUrl);
          html_body = html_body.replace(/\{\{CURRENCY\}\}/g, currency);
          html_body = html_body.replace(/\{\{PAYMENT_AMOUNT\}\}/g, paymentAmount);
          html_body = html_body.replace(/\{\{INVOICE_URL\}\}/g, invoiceUrl);

          // TODO: Enable Emails for production
          msg = {
            // NEW
            // to: propertyEmail,
            // bcc: [
            //   { email: adminEmail }
            //   { email: config.website_admin_bcc_email }
            // ],

            // TESTING
            to: 'rahul.vagadiya+invoiceproperty@gmail.com',
            bcc: [
              { email: adminEmail }
            ],
            from: {
              email: config.website_admin_from_email,
              name: config.fromname
            },
            subject: `STAYHOPPER: Settle ${invoiceMonthYear} invoice to activate property`,
            text: `Settle ${invoiceMonthYear} invoice to activate property`,
            html: html_body
          };
          sgMail.send(msg);
          console.log(`1. Property deactivated due to unpaid ${invoiceMonthYear} invoice, and notification sent To Property @ '${propertyEmail}' (DEBUG: Sent to Admin only)`);
        }

        const property = await Property.findOne({_id: invoice.property._id});
        property.approved = false;
        propertiesDeactivatedIds.push(property._id.toString());
        await property.save();
        return invoice;
      })
    );

    // unique
    propertiesDeactivatedIds = [...new Set(propertiesDeactivatedIds)];

    // Send email to admin regarding reminders
    if (adminEmail && pendingInvoices.length) {
      const invoiceMonthYear = pendingInvoices[0].invoiceForMonthString;
      const invoicesUrl = `${config.extranet_url}app/invoices`;

      let html_body = fs.readFileSync("public/invoice-emails/invoice-deactivate-admin.html","utf8");
      html_body = html_body.replace(/\{\{INVOICE_MONTH\}\}/g, invoiceMonthYear);
      html_body = html_body.replace(/\{\{PROPERTIES_COUNT_STR\}\}/g, propertiesDeactivatedIds.length === 1
        ? `${propertiesDeactivatedIds.length} property`
        : `${propertiesDeactivatedIds.length} properties`
      );
      html_body = html_body.replace(/\{\{INVOICES_URL\}\}/g, invoicesUrl);

      // TODO: Enable Emails for production
      msg = {
        // NEW
        // to: adminEmail,
        // bcc: [
        //   { email: config.website_admin_bcc_email }
        // ],

        // TESTING
        to: 'rahul.vagadiya+invoice@gmail.com',
        bcc: [
          { email: adminEmail }
        ],
        from: {
          email: config.website_admin_from_email,
          name: config.fromname
        },
        subject: `STAYHOPPER: ${propertiesDeactivatedIds.length === 1
          ? propertiesDeactivatedIds.length + ' property'
          : propertiesDeactivatedIds.length + ' properties'
        } have been deactivated due to non-payment`,
        text: `${propertiesDeactivatedIds.length === 1
          ? propertiesDeactivatedIds.length + ' property'
          : propertiesDeactivatedIds.length + ' properties'
        } have been deactivated due to non-payment`,
        html: html_body
      };
      sgMail.send(msg);
      console.log(`2. ${propertiesDeactivatedIds.length === 1
        ? `${propertiesDeactivatedIds.length} property`
        : `${propertiesDeactivatedIds.length} properties`
      } deactived due to ${pendingInvoices.length} unpaid invoices for ${invoiceMonthYear}`);
    }
  }
};


// Manually Generate Invoices - for a specific date? or previous month?
// invoicesCtrl.generateInvoices(new Date('11/01/2020'));
// previous month? leave empty
// specific date? pass as argument

// Generate Invoices - 1st of every month for the previous month
// cron.schedule("0 0 2 * *", async () => {
cron.schedule("0 0 1 * *", async () => {
  console.log('generateInvoicesStatus running at', new Date());

  // 1. Get Today's date (Should be 1st of a month)
  // const todayUtcDateMoment = moment.utc(new Date('2020-03-01')); // Debug
  const todayUtcDateMoment = moment.utc(new Date());

  // 2. Get the previous month for billing
  const invoiceForDateMoment = moment(todayUtcDateMoment).subtract(1, 'month').startOf('month');
  const invoiceForDate = invoiceForDateMoment.toDate();
  // console.log('invoiceForDate', invoiceForDate);

  const generateInvoicesStatus = await invoicesCtrl.generateInvoices(invoiceForDate);
});

// Manually send Invoice Reminders
// invoicesCtrl.sendUnpaidInvoiceReminders();

// Reminder for Invoices - 7th of every month
// cron.schedule("1 0 2 * *", async () => {
cron.schedule("0 0 7 * *", async () => {
  console.log('sendUnpaidInvoiceRemindersStatus running at', new Date());
  const sendUnpaidInvoiceRemindersStatus = await invoicesCtrl.sendUnpaidInvoiceReminders();
});

// Manually deactivate properties with unpaid Invoice
// invoicesCtrl.deactivatePropertiesWithUnpaidInvoices();

// Deactivate properties with unpaid Invoices - 9th of every month
// cron.schedule("2 0 2 * *", async () => {
cron.schedule("0 0 9 * *", async () => {
  console.log('deactivateUnpaidPropertiesStatus running at', new Date());
  const deactivateUnpaidPropertiesStatus = await invoicesCtrl.deactivatePropertiesWithUnpaidInvoices();
});
