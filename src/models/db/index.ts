import { Sequelize } from '@sequelize/core';
import { Env } from '../../services';
import { member } from './members';
// https://github.com/sequelize/sequelize/issues/1774#issuecomment-126714889
require('pg').defaults.parseInt8 = true;

const sequelize = new Sequelize(`postgres://${Env.postgreUser}:${Env.postgrePass}@${Env.postgreDB}`, {
    logging: false
});

const db: any = {
    Member: member(sequelize)
};

db.sequelize = sequelize
db.Sequelize = Sequelize

export default db;
