const moment = require('moment');

const service = {
  getNearestCheckinTimeMoment: () => {
    const mins = 30;

    const todayMoment = moment();
    const remainder = mins - (todayMoment.minute() % mins);
    const nearestCheckinTimeMoment = moment(todayMoment).add(remainder, "minutes");
    // const dateTime = nearestCheckinTimeMoment.format("DD.MM.YYYY, h:mm:ss a");
    // console.log(dateTime);
    return nearestCheckinTimeMoment.startOf("minutes");
  }
};

module.exports = service;