import { HostError } from '../errors/index.js'

class HostValidationMiddleware {

    validate = (hosts) =>{
        if (!Array.isArray(hosts))
        hosts = [hosts]
        return async (req, res, next) =>{
            if (!hosts) return next()
            const hostName = req.get('host')
            console.log("Host --->", hostName )
            /* console.log("host origin ---->",req.get('Origin'))
            console.log("host origin 2 ---->",req.get('origin'))
            console.log("host origin 3 ---->",req.headers.origin)
            console.log("host origin 5 ---->",req.header('Origin'))
            //console.log(req);
             */for (const host of hosts){
              if (hostName === host){
                    return next()
                }
            }
            next(new HostError())
        }
    }
}
export const hostValidate = new HostValidationMiddleware()
