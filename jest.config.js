export default {
  testEnvironment: 'node',
  verbose: true,
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  setupFilesAfterEnv: [
    // './test/setup.js'
  ],
  setupFiles: [
    './test/setup.js'
  ],
  transform: {
     ".js": "jest-esm-transformer"
  },
  //testMatch: ['**/test/**/*.spec.js'],
  // testRegex: ".*.test.(js)?$"

}
