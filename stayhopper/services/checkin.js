const moment = require('moment');
require('moment-precise-range-plugin');

const { checkout } = require('../controllers/api/v2/main');
const dateTimeService = require('./date-time');
const genericService = require('./generic');

const service = {
  debug: false,

  // expanding 1.
  getDatesAndHoursStayParams: params => {
    const checkinDate = params.checkinDate;
    const checkinTime = params.checkinTime;
    const checkoutDate = params.checkoutDate;
    const checkoutTime = params.checkoutTime;
    // const propertyWeekends = params.weekends || [];

    const checkinDateMoment = moment(`${checkinDate} ${checkinTime}`, 'DD/MM/YYYY HH:mm');
    const checkoutDateMoment = moment(`${checkoutDate} ${checkoutTime}`, 'DD/MM/YYYY HH:mm');

    // console.log('============getDatesAndHoursStayParams============');
    // console.log('checkinDateMoment', checkinDateMoment.format('DD MMM YYYY hh:mm a'));
    // console.log('checkoutDateMoment', checkoutDateMoment.format('DD MMM YYYY hh:mm a'));

    // At least 1 calculation is needed
    let timeRemaining = dateTimeService.getDiffInMins(checkoutDateMoment, checkinDateMoment);

    // Inputs
    let currentCheckinDateMoment = moment(checkinDateMoment);
    // const checkinTimeStr = checkinDateMoment.format('HH:mm');
    // const checkoutTimeStr = checkoutDateMoment.format('HH:mm');

    const stayDetailParams = [];

    // Run at least once [while (timeRemaining)]
    do {
      const checkinTimeStr = currentCheckinDateMoment.format('HH:mm');
      let checkoutTimeStr = '00:00';
      if (currentCheckinDateMoment.format('DD/MM/YYYY') === checkoutDateMoment.format('DD/MM/YYYY')) {
        checkoutTimeStr = checkoutDateMoment.format('HH:mm');
      }

      const checkinTimeHours = parseInt(currentCheckinDateMoment.format('HH'));
      const currentCheckinDateWeekDayName = checkinDateMoment.format('ddd').toLowerCase();
      // const dayType = propertyWeekends.indexOf(currentCheckinDateWeekDayName) > -1 ? 'weekend' : 'weekday';
      let rateType = 'fullDay';
      let hours = [];

      // Scenario 1: Standard day: 14:00 to next day 12:00
      if (checkinTimeStr === '14:00') {
        const nextDateForStandardCheckinMoment = moment(currentCheckinDateMoment).add(22, 'hours');
        if (nextDateForStandardCheckinMoment.isSameOrBefore(checkoutDateMoment)) {
          rateType = 'standardDay';
        } else {
          hours = dateTimeService.getHoursFromTo(checkinTimeStr, checkoutTimeStr);
        }
      } else if (checkinTimeHours < 14) {
        // Scenario 2: we're earlier than 14:00 hours, then check if the NEXT day (14:00 hours onwards) has a standard check in
        const supposeNextDay = moment(currentCheckinDateMoment)
        supposeNextDay.set({hour: 14, minute: 0, second: 0, millisecond: 0});
        const nextDateForStandardCheckinMoment = moment(supposeNextDay).add(22, 'hours');
        // has?
        if (nextDateForStandardCheckinMoment.isSameOrBefore(checkoutDateMoment)) {
          // 1. previous day WAS standardDay? Back to back standard day? then jump straight to standardDay logic
          const previousDayParams = stayDetailParams[stayDetailParams.length - 1];
          if (previousDayParams && previousDayParams.rateType === 'standardDay') {
            rateType = 'standardDay';
            currentCheckinDateMoment.set({hour: 14, second: 0, minute: 0, millisecond: 0});
          } else {
            // 2. previous day was NOT standardDay? - then just take current time till 14 (eg: 10:00 to 14:00) and restart the process
            checkoutTimeStr = '14:00';
            hours = dateTimeService.getHoursFromTo(checkinTimeStr, checkoutTimeStr);
          }

        } else {
          // Doesnt have? then just take hours of the remaining day (eg: 10:00 to 00:00)
          hours = dateTimeService.getHoursFromTo(checkinTimeStr, checkoutTimeStr);
        }
      } else if (checkinTimeHours >= 14) {
        // Scenario 3: hours of the remaining day (15:00 to 00:00)
        hours = dateTimeService.getHoursFromTo(checkinTimeStr, checkoutTimeStr);
      }

      if (service.debug) {
        console.log('currentCheckinDateMoment', currentCheckinDateMoment);
        console.log('checkoutDateMoment', checkoutDateMoment);
        console.log('checkinTimeStr', checkinTimeStr);
        console.log('checkoutTimeStr', checkoutTimeStr);
      }

      if (rateType === 'standardDay') {
        stayDetailParams.push({
          date: currentCheckinDateMoment.format('DD/MM/YYYY'),
          // dayType, // weekend or weekday
          rateType, // fullDay or standardDay
          hours,
          hoursKeys: dateTimeService.getHoursKeysFromHours(hours)
        });
        // Ensure the next date for check in starts from same time next day.
        currentCheckinDateMoment = moment(currentCheckinDateMoment).add(22, 'hours');
      } else {
        stayDetailParams.push({
          date: currentCheckinDateMoment.format('DD/MM/YYYY'),
          // dayType,
          rateType,
          hours,
          hoursKeys: dateTimeService.getHoursKeysFromHours(hours)
        });

        // Set the new check in time for next round
        // 1. Reset to 00:00 hours of NEXT DAY
        if (checkoutTimeStr === '00:00') {
          currentCheckinDateMoment = moment(currentCheckinDateMoment).add(1, 'days');
          currentCheckinDateMoment.set({hour: 0, minute: 0, second: 0, millisecond: 0})
        } else {
          // 2. OR, Reset to the specific hours in the SAME DAY
          const newCheckinTime = checkoutTimeStr.split(':');
          currentCheckinDateMoment.set({hour: parseInt(newCheckinTime[0]), minute: parseInt(newCheckinTime[1]), second: 0, millisecond: 0})
        }
      }

      timeRemaining = dateTimeService.getDiffInMins(checkoutDateMoment, currentCheckinDateMoment);

      if (service.debug) {
        console.log('timeRemaining', timeRemaining);
      }
    } while (timeRemaining)

    return stayDetailParams;
  },

  /**
   * Provide checkin and checkout details to get stay duration label
   * @example
   * 3 hours, 2 days, 30 days, 1 month, 3+ months, 12 months)
   */
  getStayDuration: ({checkinDate, checkoutDate, checkinTime, checkoutTime}) => {
    let value = '';
    let unit = '';
    let label = '';
    if (checkinDate && checkoutDate && checkinTime && checkoutTime) {
      const checkinDateMoment = moment(`${checkinDate} ${checkinTime}`, 'DD/MM/YYYY HH:mm');
      const checkoutDateMoment = moment(`${checkoutDate} ${checkoutTime}`, 'DD/MM/YYYY HH:mm');
      const isStandardDayBooking = checkinTime === '14:00' && checkoutTime === '12:00';
      if (isStandardDayBooking) {
        const daysDiff = checkoutDateMoment.diff(checkinDateMoment, 'days');
        if (daysDiff < 30) {
          value = checkoutDateMoment.diff(checkinDateMoment, 'days') + 1;
          unit = 'days';
          label = `${value} ${genericService.pluralize(value, 'Day', 'Days')}`;
        } else if (daysDiff < 31) {
          value = 1;
          unit = 'months';
          label = `1 Month`;
        } else {
          value = checkoutDateMoment.diff(checkinDateMoment, 'months');
          unit = 'months';
          label = value === 12
            ? `${value} Months`
            : `${value}+ Months`
          ;
        }
      } else {
        const hours = checkoutDateMoment.diff(checkinDateMoment, 'hours');
        if (hours <= 24) {
          value = hours;
          unit = 'hours';
          label = `${value} ${genericService.pluralize(value, 'Hour', 'Hours')}`;
        } else if (hours <= (24 * 30)) {
          value = Math.ceil(hours / 24);
          unit = 'days';
          label = `${value} ${genericService.pluralize(value, 'Day', 'Days')}`;
        } else if (hours <= (24 * 31)) {
          value = 1;
          unit = 'months';
          label = `1 Month`;
        } else {
          value = Math.floor(hours / (24 * 30));
          unit = 'months';
          label = value === 12
            ? `${value} Months`
            : `${value}+ Months`
          ;
        }
      }
    }
    return { label, value, unit };
  },

  /**
   * Provide checkin and checkout details to get stay duration label
   * @example
   * 3 hours, 2 days, 3 hours, 30 days and 15 hours, 1 month and 4 days and 12 hours, 3 months 12 days and 4 hours, 12 months)
   */
  getAccurateStayDurationLabel: ({checkinDate, checkoutDate, checkinTime, checkoutTime}) => {
    if (checkinDate && checkoutDate && checkinTime && checkoutTime) {
      const checkinDateMoment = moment(`${checkinDate} ${checkinTime}`, 'DD/MM/YYYY HH:mm');
      const checkoutDateMoment = moment(`${checkoutDate} ${checkoutTime}`, 'DD/MM/YYYY HH:mm');
      const isStandardDayBooking = checkinTime === '14:00' && checkoutTime === '12:00';
      // Assume same hours in case of standard day, so we don't have a wrong 
      if (isStandardDayBooking) {
        checkoutDateMoment.set({hour:14})
      }
      const preciseDiff = moment.preciseDiff(checkinDateMoment, checkoutDateMoment, true);
      const applicableUnits = ['months', 'days', 'hours', 'minutes']
        .filter(unit => {
          return !!preciseDiff[unit];
        })
      ;

      const messageArr = applicableUnits.reduce((a, unit) => {
        const unitCapitalCase = unit.charAt(0).toUpperCase() + unit.slice(1);
        return a.concat(`${preciseDiff[unit]} ${unitCapitalCase}`);
      }, [])

      let messageStr = messageArr.join(', ');
      // Replace last "," with "and"
      lastCommaPos = messageStr.lastIndexOf(',');
      if (lastCommaPos > -1 ) {
        messageStr = messageStr.substr(0, lastCommaPos) + ' and' + messageStr.substr(lastCommaPos+1, messageStr.length-1)
      }
      console.log(messageStr);
      return messageStr;
    }
    return '';
  }
};

module.exports = service;