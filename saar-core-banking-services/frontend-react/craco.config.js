module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Only disable source maps in development for memory savings
      if (env === 'development') {
        webpackConfig.devtool = false;
      }
      
      return webpackConfig;
    },
  },
};
