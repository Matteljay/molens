//process.env.VUE_APP_VERSION = require('./package.json').version
module.exports = {
  productionSourceMap: process.env.NODE_ENV !== 'production',
  chainWebpack: config => {
    config.optimization.delete('splitChunks')
    config
      .plugin('html')
      .tap(args => {
          args[0].title = 'Molens';
          return args;
      })
  }
}
