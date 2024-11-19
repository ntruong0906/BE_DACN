'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Allcode extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here 1->n
      Allcode.hasMany(models.User, { foreignKey: 'positionId', as: 'positionData' }) //1-n
      Allcode.hasMany(models.User, { foreignKey: 'gender', as: 'genderData' }) //1-n
      Allcode.hasMany(models.Schedule, { foreignKey: 'timeType', as: 'timeTypeData' }) //1-n
      Allcode.hasMany(models.Booking, { foreignKey: 'timeType', as: 'timeTypeDataPatient' }) //1-n
      Allcode.hasMany(models.Booking, { foreignKey: 'statusId', as: 'statusTypeDataPatient' }) //1-n
      Allcode.hasMany(models.Doctor_Info, { foreignKey: 'priceId', as: 'priceTypeData' }) //1-n
      Allcode.hasMany(models.Doctor_Info, { foreignKey: 'paymentId', as: 'paymentTypeData' }) //1-n
      Allcode.hasMany(models.Doctor_Info, { foreignKey: 'provinceId', as: 'provinceTypeData' }) //1-n
    }
  };
  Allcode.init({
    keyMap: DataTypes.STRING,
    type: DataTypes.STRING,
    valueEn: DataTypes.STRING,
    valueVi: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Allcode',
  });
  return Allcode;
};