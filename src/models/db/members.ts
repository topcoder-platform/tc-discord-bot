import { DataTypes, Model } from '@sequelize/core';

export function member(sequelize: any): any {

    class Member extends Model {
        declare id: string;
        declare username: string;
        declare discriminator: string;
        declare nickname: string | null;
        declare tcHandle: string | null;
        declare verifiedDate: Date | null;
        declare discordValidTC: boolean | null;
    }

    Member.init({
        id: {
            type: new DataTypes.STRING(),
            primaryKey: true
        },
        username: {
            type: new DataTypes.STRING(),
            allowNull: false
        },
        discriminator: {
            type: new DataTypes.STRING(),
            allowNull: false
        },
        nickname: {
            type: new DataTypes.STRING(),
            allowNull: true
        },
        tcHandle: {
            type: new DataTypes.STRING(),
            allowNull: true
        },
        verifiedDate: {
            type: new DataTypes.DATE(),
            allowNull: true
        },
        discordValidTC: {
            type: new DataTypes.BOOLEAN(),
            allowNull: true
        }
    }, {
        tableName: 'membersMap',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        timestamps: true,
        sequelize
    });

    return Member;
}
