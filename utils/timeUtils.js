const moment = require('moment-timezone');


const convertToPKT = (dateTime) => {
  return moment.utc(dateTime).tz('Asia/Karachi');
};


const convertToPKTAndSubtractHours = (dateTime, hours = 5) => {
  return moment.utc(dateTime).tz('Asia/Karachi').subtract(hours, 'hours');
};

const convertDateStringToPKT = (dateString) => {
  return moment.tz(dateString, 'Asia/Karachi');
};

const formatTimeInPKT = (dateTime, format = 'HH:mm') => {
  return moment.utc(dateTime).tz('Asia/Karachi').format(format);
};

const createDateTimeInPKT = (dateOnly, timeOnly) => {
  return `${dateOnly}T${timeOnly}`;
};

const calculateDurationHours = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end - start) / (1000 * 60 * 60); // Convert ms to hours
};

const isWeekend = (date) => {
  const day = new Date(date).getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
};

const getDayBoundariesInPKT = (date) => {
  const pktDate = convertToPKT(date);
  return {
    startOfDay: pktDate.clone().startOf('day'),
    endOfDay: pktDate.clone().endOf('day')
  };
};

module.exports = {
  convertToPKT,
  convertToPKTAndSubtractHours,
  convertDateStringToPKT,
  formatTimeInPKT,
  createDateTimeInPKT,
  calculateDurationHours,
  isWeekend,
  getDayBoundariesInPKT
};
