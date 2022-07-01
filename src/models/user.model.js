import sqz from '../db/index.js'
import Sequelize from 'sequelize'


export const User = sqz.define("User", {
    id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
    },
    name: { type: Sequelize.STRING, },
    email: {
        type: Sequelize.STRING,
        unique: true
    },
    phone_number: { type: Sequelize.STRING },
    type_user: {
        type: Sequelize.ENUM({
            values: ['administrador', 'propietario', 'copropietario', 'colaborador', 'arrendatario']
        }),
    },
    id_number: { type: Sequelize.STRING },
    url_picture: { type: Sequelize.STRING },
    address: { type: Sequelize.STRING },
    gender: {
        type: Sequelize.ENUM({
            values: ['Hombre', 'Mujer']
        }),
    },
    type_doc: { type: Sequelize.STRING },
    state: { type: Sequelize.BOOLEAN },
    birth_date: { type: Sequelize.DATE, },
    /*
    created_at: {
        type: Sequelize.DATE,
        defaultValue: new Date()
    },
    updated_at: {
        type: Sequelize.DATE,
        defaultValue: new Date()
    },

     */
  plate1: { type: Sequelize.STRING },
  plate2: { type: Sequelize.STRING },
}, {
    timestamps: true,
    freezeTableName: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});
