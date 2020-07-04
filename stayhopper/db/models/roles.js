const db = require('../mongodb');
const bcrypt = require('bcrypt');
const uniqueValidator = require('mongoose-unique-validator');
const config = require("config");

const permissionsEnum = Object.values(config.permissions);
const PermissionSchema = {
  type: String,
  enum: permissionsEnum,
  default: ''
};

const Roles = new db.Schema({
  name: {
    type: String,
    required: [true, 'Name is required']
  },
  permissions: [PermissionSchema]
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

Roles.plugin(uniqueValidator, { message: '{PATH} to be unique.' });

RoleModel = db.model('roles', Roles);
module.exports = RoleModel;