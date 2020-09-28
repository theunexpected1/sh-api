const moment = require('moment');

const service = {
  /**
   * Returns nearest check in time to the nearest 30 minutes (after)
   * @example
   * if current time is 09:33 => returned time will be 10:00
   */
  getNearestCheckinTimeMoment: () => {
    const mins = 30;

    const todayMoment = moment();
    const remainder = mins - (todayMoment.minute() % mins);
    const nearestCheckinTimeMoment = moment(todayMoment).add(remainder, "minutes");
    // const dateTime = nearestCheckinTimeMoment.format("DD.MM.YYYY, h:mm:ss a");
    // console.log(dateTime);
    return nearestCheckinTimeMoment.startOf("minutes");
  },

  /**
   * Ensures 2 digit number
   * @example
   * 2 => 02
   * 12 => 12
   */
  getNumberWithLeadingZero: num => ('0' + num).substr(-2),

  /**
   * Returns array of hours
   * @example 
   * 1. ('09:00', '11:00') => ["09:00", "09:30", "10:00", "10:30"]
   * (Enabled) 2. ('22:30', '02:00') => ["22:30", "23:00", "23:30", "00:00"]
   * (Disabled) 3. ('22:30', '02:00') => ["22:30", "23:00", "23:30", "00:00", "00:30", "01:00", "01:30"]
   * To enable example 3 and disable example 2, comment out this condition of the while loop (currentHour === 0 && currentMins === 0)
   */
  getHoursFromTo: (hoursFromStr, hoursToStr) => {
    const hoursFromArr = hoursFromStr.split(':');
    const hoursToArr = hoursToStr.split(':');
    let currentHour = parseInt(hoursFromArr[0]);
    let currentMins = parseInt(hoursFromArr[1]);
    let targetHour = parseInt(hoursToArr[0]);
    let targetMins = parseInt(hoursToArr[1]);
    let hours = [];
    // Repeat until we get the target hours (ensure at least once is run, otherwise start from 00:00 will be ignored)
    do {
      const hour = [
        service.getNumberWithLeadingZero(currentHour),
        service.getNumberWithLeadingZero(currentMins)
      ].join(':');
      hours.push(hour)

      if (currentMins === 0) {
        currentMins = 30
      } else {
        currentMins = 0;
        currentHour = (currentHour + 1 === 24 ? 0 : currentHour + 1)
      }
    } while (!(
      (currentHour === targetHour && currentMins === targetMins) ||
      (currentHour === 0 && currentMins === 0)
    ))
    return hours;
  },

  /**
   * Convert each hourly representation to it's respective key
   * IMPORTANT NOTE: Ensure to calculate the rate for the key as half it's value - '12:30' should be half price of 'h12'
   * This is because hourly representation would include both two 30 minute intervals for an hour, and so the price has to split
   * h12 => '12:00' and '12:30'.
   * So if h12 costs 10 dhs then we will have to use 5 dhs, so that 12:00 costs 5 dhs and 12:30 costs 5 dhs, collectively costing 10 dhs for the whole hour.
   * @example
   * '12:00' => 'h12'
   * '03:30' => 'h3'
   */
  getHoursKeysFromHours: hours => {
    hours = hours || [];
    return hours.map(hour => {
      return 'h' + parseInt(hour.split(':')[0])
    })
  },

  getDiffInHours: (futureDateMoment, pastDateMoment) => futureDateMoment.diff(pastDateMoment, 'hours'),
  getDiffInMins: (futureDateMoment, pastDateMoment) => futureDateMoment.diff(pastDateMoment, 'minutes'),
};

module.exports = service;