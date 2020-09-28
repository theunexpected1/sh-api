const express = require("express");
const router = express.Router();
const db = require('mongoose');
const config = require('config');

const Property = require("../../db/models/properties");
const Room = require("../../db/models/rooms");
const HotelAdmin = require("../../db/models/hoteladmins");
const Booking = require("../../db/models/bookings");
const Slot = require("../../db/models/slots");
const UserBooking = require("../../db/models/userbookings");
const BookLog = require("../../db/models/bookinglogs");

const _ = require("underscore");
const moment = require('moment');

router.get("/", async (req, res) => {
  company = req.query.company;
  property = req.query.property;
  date = req.query.date;
  let companies = await HotelAdmin.find();
  let properties = await Property.find();
  let where = {};
  where.property_id = property;
  let rooms = await Room.find(where)
    .populate("room_type")
    .populate("room_name").lean().exec();  
  for(var i=0;i<rooms.length;i++){
    total_bookings = await UserBooking.find({'room.room':rooms[i]._id,checkin_date:moment(date).format('YYYY-MM-DD'),cancel_approval:{$ne:1}}).count();
    rooms[i].total_bookings = total_bookings;
  }  
  let data = {
    companies: companies,
    properties: properties,
    company: company,
    property: property,
    date: date,
    rooms: rooms
  };
  res.render("admin/availability/list", data);
});

router.get("/:id", async (req, res) => {
  let room = await Room.findOne({ _id: req.params.id })
    .populate("room_type")
    .populate("room_name");
  let date = req.query.date;
  let property = await Property.findOne({ _id: room.property_id }).populate(
    "company"
  );
  let bookings = await Booking.findOne({ room: room._id, date: date }).populate(
    "slots.slot"
  );
  let bookingArray = [];
  if (typeof bookings != "undefined" && bookings != null) {
    if (typeof bookings.slots != "undefined")
      bookingArray = _.toArray(bookings.slots);
  }
  let slots = await Slot.find().sort({_id:1});
  let data = {
    room: room,
    property: property,
    slots: slots,
    date: date,
    bookingArray: bookingArray,
    _: _
  };
  // return res.json({data:slots,bookingArray:bookingArray});
  res.render("admin/availability/view", data);
});

router.post("/block", async (req, res) => {
  let room_id = req.body.room;
  let property_id = req.body.property;
  let no = req.body.no;
  let slot_id = req.body.slot;
  let date = req.body.date;

  let room = await Room.findOne({ _id: room_id }).sort({_id:1});
  let slot = await Slot.findOne({ _id: slot_id }).sort({_id:1});

  if (room && slot && date) {
    let where = {
      room: room._id,
      date: date
    };
    let booking = await Booking.findOne(where);
    // return res.json(booking.slots[0]._id);
    if (!booking) {
      booking = new Booking();
    }

    booking.property = room.property_id;
    booking.room = room._id;
    booking.date = date;

    if (booking.slots) {
      for (i in booking.slots) {
        // console.log("---"+booking.slots[i].slot);
        // console.log("slot"+slot);
        if (
          booking.slots[i].slot == slot._id.toString() &&
          booking.slots[i].number == no &&
          booking.slots[i].status == "BLOCKED"
        ) {
          try {
            await Booking.update(
              { _id: booking._id },
              { $pull: { slots: { number: no, slot: slot._id } } }
            );
            await BookLog.deleteMany({slot:db.Types.ObjectId(slot._id),room: db.Types.ObjectId(room._id),date:date,number:parseInt(no)});
            return res.json({ status: 2, data: "Un Block successfully!" });
          } catch (error) {
            return res.json(error);
          }
        }
      }
      let temp = {
        slot: slot._id,
        number: no,
        status: "BLOCKED"
      };
      booking.slots.push(temp);
    } else {
      booking.slots.push({
        slot: slot._id,
        number: no,
        status: "BLOCKED"
      });
    }
    try {
      let bookinglog = new BookLog();
      bookinglog.property = room.property_id;
      bookinglog.room = room._id;
      bookinglog.slot = slot._id;
      bookinglog.number = no;
      bookinglog.date = date;
      bookinglog.timestamp = new Date(moment(new Date(date)).format('YYYY-MM-DD'));
      bookingLog.slotStartTime = moment(`${date} ${slot.label}`, 'YYYY-MM-DD HH:mm');

      await bookinglog.save();

      await booking.save();
      return res.json({ status: 1, data: "Block successfully!" });
    } catch (error) {
      return res.json({
        status: 0,
        data: "Some error occured. Please contact administrator"
      });
    }
  } else {
    return res.json({
      status: 0,
      data: "Some error occured. Please contact administrator"
    });
  }
});

router.post("/property/company", async (req, res) => {
  let company = req.body.company;
  if (company) {
    let properties = await Property.find({ company: company });
    if (properties) {
      res.json({ status: 1, properties: properties });
    } else {
      res.json({ status: 0, message: "No properties!" });
    }
  } else {
    res.json({ status: 0, message: "No properties!" });
  }
});

router.post("/company/property", async (req, res) => {
  let property_id = req.body.property;
  if (property_id) {
    let property = await Property.findOne({ _id: property_id });
    if (property) {
      let company = await HotelAdmin.findOne({ _id: property.company });
      if (company) {
        res.json({ status: 1, company: company });
      } else {
        res.json({ status: 0, message: "No Company!" });
      }
    } else {
      res.json({ status: 0, message: "No Company!" });
    }
  } else {
    res.json({ status: 0, message: "No Company!" });
  }
});

router.post('/get_to_slots',async(req,res)=>{
  let from_id = req.body.from_id;
  let slot = await Slot.findOne({_id:from_id}).sort({_id:1});
  let to_slots = await Slot.find().sort({_id:1}).skip(parseInt(slot.no));
  return res.json({status:1,slots:to_slots});
});

router.post('/block_range',async(req,res)=>{
  let date = req.body.date;
  date = moment(new Date(date)).format('YYYY-MM-DD');
  room_no = req.body.room_no;
  let room = req.body.room;
  let property = req.body.property;
  let from_slot = req.body.from_slot;
  let to_slot = req.body.to_slot;
  from_slot = await Slot.findOne({_id:from_slot}).sort({_id:1});
  to_slot = await Slot.findOne({_id:to_slot}).sort({_id:1});
  let skip = parseInt(from_slot.no);
  let limit = parseInt(to_slot.no)
  let select_slots = await Slot.find().sort({_id:1}).skip((skip-1)).limit((limit-skip)+1);

  let select_slot_ids = [];
  select_slots.forEach((slot)=>{
    select_slot_ids.push(slot._id.toString());
  });
  
  let booking = await Booking.findOne({room,date});
  bookinglogs = [];
  if(!booking){
    booking = new Booking();
    booking.property = property;
    booking.room = room;
    booking.date = date;    
    booking.slots = [];
    for(var i=0; i< select_slot_ids.length;i++){
      booking.slots.push({
        status:'BLOCKED',
        slot:select_slot_ids[i],
        number:room_no
      });
      bookinglogs.push(
        {
          property:property,
          room:room,
          slot:select_slot_ids[i],
          number:room_no,
          date:date,
          timestamp:new Date(moment(new Date(date)).format('YYYY-MM-DD'))
        }
      );
    }
  }else{
    other_slots = [];    
    console.log({'length':booking.slots.length});
    console.log({'id':booking._id});
    for(var i=0;i<booking.slots.length;i++){
      if(booking.slots[i].status!='BLOCKED' && booking.slots[i].number==room_no){
        other_slots.push(booking.slots[i].slot.toString());
      }
    }
    for(var i=0;i<select_slot_ids.length;i++){
      console.log(!_.contains(other_slots,select_slot_ids[i].toString()));
      if(!_.contains(other_slots,select_slot_ids[i].toString())){
        booking.slots.push({
          status:'BLOCKED',
          slot:select_slot_ids[i],
          number:room_no
        }); 
        bookinglogs.push({
            property:property,
            room:room,
            slot:select_slot_ids[i],
            number:room_no,
            date:date,
            timestamp:new Date(moment(new Date(date)).format('YYYY-MM-DD'))
        });
      }
    }                       
  }
  await BookLog.insertMany(bookinglogs);
  await booking.save();
  return res.json({status:1});
});

router.post('/unblock_range',async(req,res)=>{
  let date = req.body.date;
  date = moment(new Date(date)).format('YYYY-MM-DD');
  room_no = req.body.room_no;
  let room = req.body.room;
  let property = req.body.property;
  let from_slot = req.body.from_slot;
  let to_slot = req.body.to_slot;
  from_slot = await Slot.findOne({_id:from_slot});
  to_slot = await Slot.findOne({_id:to_slot});
  let skip = parseInt(from_slot.no);
  let limit = parseInt(to_slot.no)
  let select_slots = await Slot.find().skip((skip-1)).limit((limit-skip)+1);
  let select_slot_ids = [];
  select_slots.forEach((slot)=>{
    select_slot_ids.push(slot._id.toString());
  });

  let booking = await Booking.findOne({room,date,'slots.number':room_no,'slots.status':{$eq:"BLOCKED"}});
  bookinglogs = [];
  if(booking){
    let slots = booking.slots;
    for(var i=0;i<slots.length;i++){ 
      if(slots[i].status=="BLOCKED" && slots[i].number == room_no && _.contains(select_slot_ids,slots[i].slot.toString())){
        bookinglogs.push(
          {
            property:property,
            room:room,
            slot:slots[i].slot,
            number:room_no,
            date:date,
            timestamp:new Date(moment(new Date(date)).format('YYYY-MM-DD'))
          }
        );  
        slots.splice(i,1);
          i = i-1;
          continue;
      }
    }
    booking.slots = slots;
    deleteFilter = {};
    deleteFilter['$or'] = [];
    for(var i = 0; i< bookinglogs.length;i++){
      deleteFilter['$or'].push(
        {
          room:db.Types.ObjectId(bookinglogs[i].room),
          number:room_no,
          slot:db.Types.ObjectId(bookinglogs[i].slot),
        }
      )
    }
    await BookLog.deleteMany(deleteFilter);
    await booking.save();
    return res.json({status:1});
  }
  return res.json({status:1});
});

router.post('/block_all',async(req,res)=>{
  let date = req.body.date;
  date = moment(new Date(date)).format('YYYY-MM-DD');
  room_no = req.body.room_no;
  let room = req.body.room;
  let property = req.body.property;
  let select_slots = await Slot.find();
  let select_slot_ids = [];
  select_slots.forEach((slot)=>{
    select_slot_ids.push(slot._id.toString());
  });

  let booking = await Booking.findOne({room,date});
  let bookinglogs = [];
  if(!booking){
    booking = new Booking();
    booking.property = property;
    booking.room = room;
    booking.date = date;    
    booking.slots = [];
    for(var i=0; i< select_slot_ids.length;i++){
      booking.slots.push({
        status:'BLOCKED',
        slot:select_slot_ids[i],
        number:room_no
      });
      bookinglogs.push(
        {
          property:property,
          room:room,
          slot:select_slot_ids[i],
          number:room_no,
          date:date,
          timestamp:new Date(moment(new Date(date)).format('YYYY-MM-DD'))
        }
      );
    }
  }else{
    other_slots = [];    
    console.log({'length':booking.slots.length});
    console.log({'id':booking._id});
    for(var i=0;i<booking.slots.length;i++){
      if(booking.slots[i].status!='BLOCKED' && booking.slots[i].number==room_no){
        other_slots.push(booking.slots[i].slot.toString());
      }
    }
    for(var i=0;i<select_slot_ids.length;i++){
      console.log(!_.contains(other_slots,select_slot_ids[i].toString()));
      if(!_.contains(other_slots,select_slot_ids[i].toString())){
        booking.slots.push({
          status:'BLOCKED',
          slot:select_slot_ids[i],
          number:room_no
        }); 
        bookinglogs.push(
          {
            property:property,
            room:room,
            slot:select_slot_ids[i],
            number:room_no,
            date:date,
            timestamp:new Date(moment(new Date(date)).format('YYYY-MM-DD'))
          }
        );
      }
    }                       
  }
  await BookLog.insertMany(bookinglogs);
  await booking.save();
  return res.json({status:1});
});


router.post('/unblock_all',async(req,res)=>{
  let date = req.body.date;
  date = moment(new Date(date)).format('YYYY-MM-DD');
  room_no = req.body.room_no;
  let room = req.body.room;
  let property = req.body.property;
  let select_slots = await Slot.find();
  let select_slot_ids = [];
  select_slots.forEach((slot)=>{
    select_slot_ids.push(slot._id.toString());
  });

  let booking = await Booking.findOne({room,date,'slots.number':room_no,'slots.status':{$eq:"BLOCKED"}});
  let bookinglogs = [];
  if(booking){
    let slots = booking.slots;
    for(var i=0;i<slots.length;i++){ 
      if(slots[i].status=="BLOCKED" && slots[i].number == room_no && _.contains(select_slot_ids,slots[i].slot.toString())){
        bookinglogs.push(
          {
            property:property,
            room:room,
            slot:slots[i].slot,
            number:room_no,
            date:date,
            timestamp:new Date(moment(new Date(date)).format('YYYY-MM-DD'))
          }
        );  
        slots.splice(i,1);
        i = i-1;
        continue;
      }
    }
    booking.slots = slots;
    deleteFilter = {};
    deleteFilter['$or'] = [];
    for(var i = 0; i< bookinglogs.length;i++){
      deleteFilter['$or'].push(
        {
          room:db.Types.ObjectId(bookinglogs[i].room),
          number:room_no,
          slot:db.Types.ObjectId(bookinglogs[i].slot),
        }
      )
    }
    await BookLog.deleteMany(deleteFilter);
    await booking.save();
    return res.json({status:1});
  }
  return res.json({status:1});
});
router.post("/reserveall", async (req, res) => {
  //get id
  let id = req.body.id;
  if (!id) {
    return res.json({ status: 0, message: "Could not reserve booking" });
  }
  //check room exists
  let roomdet = await Room.findOne({ _id:db.Types.ObjectId(id)});
  if (!roomdet) {
    return res.json({ status: 0, message: "Could not reserve booking" });
  }

  // return res.json({roomdet});

  let date = req.body.date;
  date = moment(new Date(date)).format("YYYY-MM-DD");

  for (z = 0; z <= roomdet.number_rooms; z++) {
    room_no = +z + +1;
    let room = roomdet._id;
    let property = roomdet.property_id;
    let select_slots = await Slot.find().sort({ _id: 1 });
    let select_slot_ids = [];
    select_slots.forEach(slot => {
      select_slot_ids.push(slot._id.toString());
    });

    let booking = await Booking.findOne({ room, date });
    let bookinglogs = [];
    if (!booking) {
      booking = new Booking();
      booking.property = property;
      booking.room = room;
      booking.date = date;
      booking.slots = [];
      for (var i = 0; i < select_slot_ids.length; i++) {
        booking.slots.push({
          status: "BLOCKED",
          slot: select_slot_ids[i],
          number: room_no
        });
        bookinglogs.push({
          property: property,
          room: room,
          slot: select_slot_ids[i],
          number: room_no,
          date: date,
          timestamp: new Date(moment(new Date(date)).format("YYYY-MM-DD"))
        });
      }
    } else {
      other_slots = [];
      for (var i = 0; i < booking.slots.length; i++) {
        if (
          booking.slots[i].status != "BLOCKED" &&
          booking.slots[i].number == room_no
        ) {
          other_slots.push(booking.slots[i].slot.toString());
        }
      }
      for (var i = 0; i < select_slot_ids.length; i++) {
        console.log(!_.contains(other_slots, select_slot_ids[i].toString()));
        if (!_.contains(other_slots, select_slot_ids[i].toString())) {
          booking.slots.push({
            status: "BLOCKED",
            slot: select_slot_ids[i],
            number: room_no
          });
          bookinglogs.push({
            property: property,
            room: room,
            slot: select_slot_ids[i],
            number: room_no,
            date: date,
            timestamp: new Date(moment(new Date(date)).format("YYYY-MM-DD"))
          });
        }
      }
    }
    await BookLog.insertMany(bookinglogs);
    await booking.save();
  }
  return res.json({ status: 1 });
});

router.post("/cancelall",async (req,res)=> {
  //get id
  let id = req.body.id;
  if (!id) {
    return res.json({ status: 0, message: "Could not reserve booking" });
  }
  //check room exists
  let roomdet = await Room.findOne({ _id: db.Types.ObjectId(id)});
  console.log({id});
  if (!roomdet) {
    return res.json({ status: 0, message: "Could not reserve booking" });
  }

  // return res.json({roomdet});
  let date = req.body.date;
  date = moment(new Date(date)).format('YYYY-MM-DD');

  for (z = 0; z <= roomdet.number_rooms; z++) {
  room_no = +z + +1;
  let room = roomdet._id;
  let property = roomdet.property_id;
  let select_slots = await Slot.find().sort({_id:1});
  let select_slot_ids = [];
  select_slots.forEach((slot)=>{
    select_slot_ids.push(slot._id.toString());
  });

  let booking = await Booking.findOne({room,date,'slots.number':room_no,'slots.status':{$eq:"BLOCKED"}});
  let bookinglogs = [];
  if(booking){
    let slots = booking.slots;
    for(var i=0;i<slots.length;i++){ 
      if(slots[i].status=="BLOCKED" && slots[i].number == room_no && _.contains(select_slot_ids,slots[i].slot.toString())){
        bookinglogs.push(
          {
            property:property,
            room:room,
            slot:slots[i].slot,
            number:room_no,
            date:date,
            timestamp:new Date(moment(new Date(date)).format('YYYY-MM-DD'))
          }
        );  
        slots.splice(i,1);
          i = i-1;
          continue;
      }
    }

    booking.slots = slots;
    deleteFilter = {};
    deleteFilter['$or'] = [];
    for(var i = 0; i< bookinglogs.length;i++){
      deleteFilter['$or'].push(
        {
          room:db.Types.ObjectId(bookinglogs[i].room),
          number:room_no,
          slot:db.Types.ObjectId(bookinglogs[i].slot),
        }
      )
    }
    if(deleteFilter['$or'].length > 0){
      await BookLog.deleteMany(deleteFilter);
    }
    await booking.save();
  }
  }
  return res.json({status:1});

});

//@desc bulk edit availability view page, inside modal
router.post("/bulkedit", async (req, res) => {
  let property = req.body.property;
  //get property details if exists
  let property_details = await Property.findOne({ _id: property });
  let slots = await Slot.find().sort({ _id: 1 });
  let data = {};
  data.slots = slots;
  data.property = property;

  if (property_details) {
    data.name = property_details.name;
    data.rooms = [];
    if (property_details.rooms.length > 0) {
      let rooms = property_details.rooms;
      for (var i = 0; i < rooms.length; i++) {
        let room = await Room.findOne({ _id: rooms[i] }).populate("room_name");
        if (room) {
          let room_name = room.custom_name;
          if (typeof room_name == "undefined" || room_name == "") {
            room_name = room.room_name.name;
          }
          data.rooms.push({
            name: room_name,
            id: room._id
          });
        }
      }
    }
  }
  return res.render("admin/availability/bulkedit", data);
});

//@desc bulk edit availability view page, inside modal
router.post("/bulkedit/update", async (req, res) => {
  //get date range
  let from_date = req.body.from;
  let to_date = req.body.to;
  var from = new Date(from_date);
  var to = new Date(to_date);
  var timeDiff = Math.abs(to.getTime() - from.getTime());
  var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
  if (diffDays > config.dateBlockNumber) {
    return res.json({
      status: 0,
      message: "Could not block more than "+config.dateBlockNumber+" days on single session"
    });
  } else {
    let dates = [];
    let startDate = moment(new Date(from)).format("YYYY-MM-DD");
    dates.push(startDate);
    for (var i = 1; i <= diffDays; i++) {
      let date = moment(new Date(from))
        .add(i, "days")
        .format("YYYY-MM-DD");
      dates.push(date);
    }
    //block range
    let room = req.body.rooms;
    let property = req.body.property;
    let from_slot = req.body.from_slot;
    let to_slot = req.body.to_slot;
    from_slot = await Slot.findOne({ _id: from_slot }).sort({ _id: 1 });
    to_slot = await Slot.findOne({ _id: to_slot }).sort({ _id: 1 });
    let skip = parseInt(from_slot.no);
    let limit = parseInt(to_slot.no);
    let select_slots = await Slot.find()
      .skip(skip - 1)
      .limit(limit - skip + 1)
      .sort({ _id: 1 });
    let select_slot_ids = [];
    select_slots.forEach(slot => {
      select_slot_ids.push(slot._id.toString());
    });

    //check room is provided and get all rooms
    let rooms = [];
    if (room) {
      let room_det = await Room.findOne({_id:room});
      rooms.push(room_det);
    } else {
      let property_details = await Property.findOne({ _id: property }).populate('rooms');
      rooms = property_details.rooms;
    }
    if(rooms.length <= 0){
      return res.json({ status: 1, message: "No Rooms available" });
    }
    let bookinglogs = [];
    for (l = 0; l < rooms.length; l++) {
      let room = rooms[l]._id;
      console.log({room:room});
      for (var j = 0; j < dates.length; j++) {
        console.log({date:dates[j]});
        for (var k = 1; k <= rooms[l].number_rooms; k++) {
          console.log({room_no:k});
          let booking = await Booking.findOne({ room, date: dates[j] });
          if (!booking) {
            booking = new Booking();
            booking.property = property;
            booking.room = room;
            booking.date = dates[j];
            booking.slots = [];
            for (var i = 0; i < select_slot_ids.length; i++) {
              booking.slots.push({
                status: "BLOCKED",
                slot: select_slot_ids[i],
                number: k
              });
              bookinglogs.push({
                property: property,
                room: room,
                slot: select_slot_ids[i],
                number: k,
                date: dates[j],
                timestamp: new Date(
                  moment(new Date(dates[j])).format("YYYY-MM-DD")
                )
              });
            }
          } else {
            other_slots = [];
            for (var i = 0; i < booking.slots.length; i++) {
              if (
                booking.slots[i].status != "BLOCKED" &&
                booking.slots[i].number == k
              ) {
                other_slots.push(booking.slots[i].slot.toString());
              }
            }
            for (var i = 0; i < select_slot_ids.length; i++) {
              if (!_.contains(other_slots, select_slot_ids[i].toString())) {
                booking.slots.push({
                  status: "BLOCKED",
                  slot: select_slot_ids[i],
                  number: k
                });
                bookinglogs.push({
                  property: property,
                  room: room,
                  slot: select_slot_ids[i],
                  number: k,
                  date: dates[j],
                  timestamp: new Date(
                    moment(new Date(dates[j])).format("YYYY-MM-DD")
                  )
                });
              }
            }
          }
          await booking.save();
          // console.log({bookinglogs,booking});
        }
      }
    }
    await BookLog.insertMany(bookinglogs);
    //end block range
    return res.json({ status: 1, message: "Slots blocked successfully!" });
  }
});

//@desc bulk edit availability view page, inside modal
router.post("/get_toslot", async (req, res) => {
  let firstSlot = await Slot.findOne({ _id: req.body.from_slot });
  let firstIndex = parseInt(firstSlot.no);
  let slots = await Slot.find()
    .sort({ _id: 1 })
    .skip(firstIndex - 1);
  if (slots.length > 0) {
    return res.json({ status: 1, slots });
  } else {
    return res.json({ status: 0, slots: [] });
  }
});

//@desc bulk unblock availability view page, inside modal
router.post("/bulkunblock", async (req, res) => {
  let property = req.body.property;
  //get property details if exists
  let property_details = await Property.findOne({ _id: property });
  let slots = await Slot.find().sort({ _id: 1 });
  let data = {};
  data.slots = slots;
  data.property = property;

  if (property_details) {
    data.name = property_details.name;
    data.rooms = [];
    if (property_details.rooms.length > 0) {
      let rooms = property_details.rooms;
      for (var i = 0; i < rooms.length; i++) {
        let room = await Room.findOne({ _id: rooms[i] }).populate("room_name");
        if (room) {
          let room_name = room.custom_name;
          if (typeof room_name == "undefined" || room_name == "") {
            room_name = room.room_name.name;
          }
          data.rooms.push({
            name: room_name,
            id: room._id
          });
        }
      }
    }
  }
  return res.render("admin/availability/bulkunblock", data);
});

//@desc bulk ubblock uodate  view page, inside modal
router.post("/bulkunblock/update", async (req, res) => {
  //get date range
  let from_date = req.body.from;
  let to_date = req.body.to;
  var from = new Date(from_date);
  var to = new Date(to_date);
  var timeDiff = Math.abs(to.getTime() - from.getTime());
  var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
  if (diffDays > config.dateBlockNumber) {
    return res.json({
      status: 0,
      message: "Could not block more than "+config.dateBlockNumber+" days on single session"
    });
  } else {
    let dates = [];
    let startDate = moment(new Date(from)).format("YYYY-MM-DD");
    dates.push(startDate);
    for (var i = 1; i <= diffDays; i++) {
      let date = moment(new Date(from))
        .add(i, "days")
        .format("YYYY-MM-DD");
      dates.push(date);
    }
    //block range
    let room = req.body.rooms;
    let property = req.body.property;
    let from_slot = req.body.from_slot;
    let to_slot = req.body.to_slot;
    from_slot = await Slot.findOne({ _id: from_slot }).sort({ _id: 1 });
    to_slot = await Slot.findOne({ _id: to_slot }).sort({ _id: 1 });
    let skip = parseInt(from_slot.no);
    let limit = parseInt(to_slot.no);
    let select_slots = await Slot.find()
      .skip(skip - 1)
      .limit(limit - skip + 1)
      .sort({ _id: 1 });
    let select_slot_ids = [];
    select_slots.forEach(slot => {
      select_slot_ids.push(slot._id.toString());
    });
    //check room is provided and get all rooms
    let rooms = [];
    if (room) {
      let room_det = await Room.findOne({_id:room});
      rooms.push(room_det);
    } else {
      let property_details = await Property.findOne({ _id: property }).populate('rooms');
      rooms = property_details.rooms;
    }
    if(rooms.length <= 0){
      return res.json({ status: 1, message: "No Rooms available" });
    }
    for(var l=0;l<rooms.length;l++){
      let room = rooms[l]._id;
      for (var j = 0; j < dates.length; j++) {
        for (var k = 1; k <= rooms[l].number_rooms; k++) {
          let booking = await Booking.findOne({
            room,
            date: dates[j],
            "slots.number": k,
            "slots.status": { $eq: "BLOCKED" }
          });
          bookinglogs = [];
          if (booking) {
            let slots = booking.slots;
            for (var i = 0; i < slots.length; i++) {
              if (
                slots[i].status == "BLOCKED" &&
                slots[i].number == k &&
                _.contains(select_slot_ids, slots[i].slot.toString())
              ) {
                bookinglogs.push({
                  property: property,
                  room: room,
                  slot: slots[i].slot,
                  number: k,
                  date: dates[j],
                  timestamp: new Date(
                    moment(new Date(dates[j])).format("YYYY-MM-DD")
                  )
                });
                slots.splice(i, 1);
                i = i - 1;
                continue;
              }
            }
            booking.slots = slots;
            deleteFilter = {};
            deleteFilter["$or"] = [];
            for (var i = 0; i < bookinglogs.length; i++) {
              deleteFilter["$or"].push({
                room: db.Types.ObjectId(bookinglogs[i].room),
                number: k,
                slot: db.Types.ObjectId(bookinglogs[i].slot),
                date: bookinglogs[i].date
              });
            }
            await BookLog.deleteMany(deleteFilter);
            await booking.save();
          }
        }
      }
    }
    //end block range
    return res.json({ status: 1, message: "Slots Unblocked successfully!" });
  }
});

//@desc bulk edit room availability view page, inside modal
router.post("/room/bulkedit", async (req, res) => {
  let room = req.body.room;
  let room_no = req.body.room_no;
  let slots = await Slot.find().sort({ _id: 1 });
  room_det = await Room.findOne({ _id: room });
  let data = {
    room,
    property: room_det.property_id,
    room_no,
    slots
  };
  return res.render("admin/availability/bulkeditroom", data);
});

//@desc bulk edit availability view page, inside modal
router.post("/bulkedit/room/update", async (req, res) => {
  //get date range
  let from_date = req.body.from;
  let to_date = req.body.to;
  var from = new Date(from_date);
  var to = new Date(to_date);
  var timeDiff = Math.abs(to.getTime() - from.getTime());
  var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
  if (diffDays > config.dateBlockNumber) {
    return res.json({
      status: 0,
      message:
        "Could not block more than " +
        config.dateBlockNumber +
        " days on single session"
    });
  } else {
    let dates = [];
    let startDate = moment(new Date(from)).format("YYYY-MM-DD");
    dates.push(startDate);
    for (var i = 1; i <= diffDays; i++) {
      let date = moment(new Date(from))
        .add(i, "days")
        .format("YYYY-MM-DD");
      dates.push(date);
    }
    //block range
    let room = req.body.room;
    let room_no = req.body.room_no;
    let property = req.body.property;
    let from_slot = req.body.from_slot;
    let to_slot = req.body.to_slot;
    from_slot = await Slot.findOne({ _id: from_slot }).sort({ _id: 1 });
    to_slot = await Slot.findOne({ _id: to_slot }).sort({ _id: 1 });
    let skip = parseInt(from_slot.no);
    let limit = parseInt(to_slot.no);
    let select_slots = await Slot.find()
      .skip(skip - 1)
      .limit(limit - skip + 1)
      .sort({ _id: 1 });
    let select_slot_ids = [];
    select_slots.forEach(slot => {
      select_slot_ids.push(slot._id.toString());
    });
    for (var j = 0; j < dates.length; j++) {
      let booking = await Booking.findOne({ room, date: dates[j] });
      let bookinglogs = [];
      if (!booking) {
        booking = new Booking();
        booking.property = property;
        booking.room = room;
        booking.date = dates[j];
        booking.slots = [];
        for (var i = 0; i < select_slot_ids.length; i++) {
          booking.slots.push({
            status: "BLOCKED",
            slot: select_slot_ids[i],
            number: room_no
          });
          bookinglogs.push({
            property: property,
            room: room,
            slot: select_slot_ids[i],
            number: room_no,
            date: dates[j],
            timestamp: new Date(moment(new Date(dates[j])).format("YYYY-MM-DD"))
          });
        }
      } else {
        other_slots = [];
        for (var i = 0; i < booking.slots.length; i++) {
          if (
            booking.slots[i].status != "BLOCKED" &&
            booking.slots[i].number == room_no
          ) {
            other_slots.push(booking.slots[i].slot.toString());
          }
        }
        for (var i = 0; i < select_slot_ids.length; i++) {
          if (!_.contains(other_slots, select_slot_ids[i].toString())) {
            booking.slots.push({
              status: "BLOCKED",
              slot: select_slot_ids[i],
              number: room_no
            });
            bookinglogs.push({
              property: property,
              room: room,
              slot: select_slot_ids[i],
              number: room_no,
              date: dates[j],
              timestamp: new Date(
                moment(new Date(dates[j])).format("YYYY-MM-DD")
              )
            });
          }
        }
      }
      await BookLog.insertMany(bookinglogs);
      await booking.save();
    }
    //end block range

    return res.json({ status: 1, message: "Slots blocked successfully!" });
  }
});

//@desc bulk unblock  room availability view page, inside modal
router.post("/room/bulkunblock", async (req, res) => {
  let room = req.body.room;
  let room_no = req.body.room_no;
  let slots = await Slot.find().sort({ _id: 1 });
  room_det = await Room.findOne({ _id: room });
  let data = {
    room,
    property: room_det.property_id,
    room_no,
    slots
  };
  return res.render("admin/availability/bulkunblockroom", data);
});

//@desc bulk unblock room update  view page, inside modal
router.post("/bulkunblock/room/update", async (req, res) => {
  //get date range
  let from_date = req.body.from;
  let to_date = req.body.to;
  var from = new Date(from_date);
  var to = new Date(to_date);
  var timeDiff = Math.abs(to.getTime() - from.getTime());
  var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
  if (diffDays > config.dateBlockNumber) {
    return res.json({
      status: 0,
      message: "Could not block more than "+config.dateBlockNumber+" days on single session"
    });
  } else {
    let dates = [];
    let startDate = moment(new Date(from)).format("YYYY-MM-DD");
    dates.push(startDate);
    for (var i = 1; i <= diffDays; i++) {
      let date = moment(new Date(from))
        .add(i, "days")
        .format("YYYY-MM-DD");
      dates.push(date);
    }
    //block range
    let room = req.body.room;
    let room_no = req.body.room_no;
    let property = req.body.property;
    let from_slot = req.body.from_slot;
    let to_slot = req.body.to_slot;
    from_slot = await Slot.findOne({ _id: from_slot }).sort({ _id: 1 });
    to_slot = await Slot.findOne({ _id: to_slot }).sort({ _id: 1 });
    let skip = parseInt(from_slot.no);
    let limit = parseInt(to_slot.no);
    let select_slots = await Slot.find()
      .skip(skip - 1)
      .limit(limit - skip + 1)
      .sort({ _id: 1 });
    let select_slot_ids = [];
    select_slots.forEach(slot => {
      select_slot_ids.push(slot._id.toString());
    });
    for (var j = 0; j < dates.length; j++) {
      let booking = await Booking.findOne({
        room,
        date: dates[j],
        "slots.number": room_no,
        "slots.status": { $eq: "BLOCKED" }
      });
      bookinglogs = [];
      if (booking) {
        let slots = booking.slots;
        for (var i = 0; i < slots.length; i++) {
          if (
            slots[i].status == "BLOCKED" &&
            slots[i].number == room_no &&
            _.contains(select_slot_ids, slots[i].slot.toString())
          ) {
            bookinglogs.push({
              property: property,
              room: room,
              slot: slots[i].slot,
              number: room_no,
              date: dates[j],
              timestamp: new Date(
                moment(new Date(dates[j])).format("YYYY-MM-DD")
              )
            });
            slots.splice(i, 1);
            i = i - 1;
            continue;
          }
        }
        booking.slots = slots;
        deleteFilter = {};
        deleteFilter["$or"] = [];
        for (var i = 0; i < bookinglogs.length; i++) {
          deleteFilter["$or"].push({
            room: db.Types.ObjectId(bookinglogs[i].room),
            number: room_no,
            slot: db.Types.ObjectId(bookinglogs[i].slot),
            date: bookinglogs[i].date
          });
        }
        await BookLog.deleteMany(deleteFilter);
        await booking.save();
      }
    }
    //end block range
    return res.json({ status: 1, message: "Slots Unblocked successfully!" });
  }
});
module.exports = router;
