module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps : [

    // Stage application
    {
      name      : 'sh-admin-api-staging',
      script    : 'index.js',
      env: {
        COMMON_VARIABLE: 'true',
        NODE_ENV: 'staging'
      },
      env_staging : {
        NODE_ENV: 'staging'
      },
      env_staging_vrbros : {
        NODE_ENV: 'staging-vrbros'
      }
    }
  ]
};
