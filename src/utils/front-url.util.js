export const getFrontURL = () => {
  const env = process.env.ENVIRONMENT
  switch (env) {
    case 'production':
      return process.env.PROD_APP_DOMAIN
    case 'development':
      return process.env.DEV_APP_DOMAIN
    case 'QA':
      return process.env.QA_APP_DOMAIN
    default:
      return `${process.env.LOCAL_APP_DOMAIN}:3500`
  }
}
