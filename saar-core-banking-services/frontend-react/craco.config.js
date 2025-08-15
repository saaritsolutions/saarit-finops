const CracoAlias = require("craco-alias");

module.exports = {
  plugins: [
    {
      plugin: CracoAlias,
      options: {
        source: "tsconfig",
        baseUrl: "./src",
        tsConfigPath: "./tsconfig.json",
      },
    },
  ],
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Find and modify ForkTsCheckerWebpackPlugin
      const forkTsCheckerIndex = webpackConfig.plugins.findIndex(
        (plugin) => plugin.constructor.name === 'ForkTsCheckerWebpackPlugin'
      );
      
      if (forkTsCheckerIndex !== -1) {
        // Remove the plugin entirely to prevent memory issues
        webpackConfig.plugins.splice(forkTsCheckerIndex, 1);
        console.log('Removed ForkTsCheckerWebpackPlugin to prevent memory issues');
      }
      
      // Disable source maps for development to save memory
      if (env === 'development') {
        webpackConfig.devtool = false;
      }
      
      return webpackConfig;
    },
  },
  devServer: {
    client: {
      overlay: {
        errors: false,
        warnings: false,
      },
    },
  },
};
