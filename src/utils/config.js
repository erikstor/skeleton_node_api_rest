import * as dotenv from 'dotenv'

dotenv.config()

export const config = {
    port: process.env.APP_PORT || '3000',
    host: process.env.APP_HOST || '127.0.0.1'
}


/**
 * Este dato es importante para la carga masiva de saldos previos
 */
export const staticConceptNames  = {
    fee: 'Cuota de administración',
    car_parking: 'Parqueadero carro',
    motorcycle_parking: 'Parqueadero moto',
    interest: 'Concepto interés saldos previos',
}

export const billingMassiveLoadTypes = {
  SALDO_FAVOR : 'saldo favor',
  DEUDA: 'deuda'
}


export const reservedConceptsNames = [
  ...Object.values(staticConceptNames)
]
// const px = new Proxy (stat , )
