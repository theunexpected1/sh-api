const Property = require("../db/models/properties");
const Room = require("../db/models/rooms");
const _ = require('underscore');
const propertiesCrump = async (req, res, next) => {
  property_id = req.params.id;
  property = await Property.findOne({ _id: property_id });
  let completed = [];
  if (property) {
    completed.push("basicinfo");
    if (property.rooms) {
      if(property.rooms.length>0)  
      completed.push("rooms");
    }
    if (property.images) {
      if(property.images.length>0)  
      completed.push("photos");
    }
    price = await Room.findOne({
      property_id: property._id,
      price: { $ne: null }
    });
    if(price){
        completed.push("price");
    }
    if(property.policies){
        if(property.policies.length>0)
        completed.push("policies");
    }
    if(property.payment){
          completed.push("payment");
    }
    if(property.nearby){
      if(property.nearby.length>0)
          completed.push("nearby");
    }
  }
  res.locals.completed = completed;
  res.locals.property_id = property_id;
  res.locals._ = _;
  next();
};
module.exports = propertiesCrump;
