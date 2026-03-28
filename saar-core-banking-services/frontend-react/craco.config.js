const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Only disable source maps in development for memory savings
      if (env === 'development') {
        webpackConfig.devtool = false;
      }

      // Remove the TypeScript type-checker child process during production builds.
      // fork-ts-checker-webpack-plugin spawns a separate Node.js process that uses
      // ~1 GB of RAM on top of the webpack process — this causes OOM on 4 GB VPS.
      // Type safety is enforced by the developer's IDE and CI lint; not needed at build time.
      if (env === 'production') {
        webpackConfig.plugins = webpackConfig.plugins.filter(
          (plugin) => !(plugin instanceof ForkTsCheckerWebpackPlugin)
        );
      }

      return webpackConfig;
    },
  },
};
