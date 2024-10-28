const { Sequelize } = require("sequelize");

const sequelize = new Sequelize('mama', 'root', null, {
    host: 'localhost',
    dialect: 'mysql',
    logging: false

});

let connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('connection has been established successfully');
    } catch (error) {
        console.error("Unable to connect to the database: ", error);
    }
}

module.exports = connectDB;