module.exports = {
  // Completely disable ESLint
  eslint: {
    enable: false,
  },
  // Completely disable TypeScript checking
  typescript: {
    enableTypeChecking: false,
  },
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Remove all problematic plugins
      webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
        const pluginName = plugin.constructor.name;
        const shouldRemove = [
          'ForkTsCheckerWebpackPlugin',
          'ESLintWebpackPlugin',
          'TypeScriptPlugin',
          'ModuleScopePlugin'
        ].includes(pluginName);
        
        if (shouldRemove) {
          console.log(`Removed ${pluginName} for performance`);
        }
        
        return !shouldRemove;
      });
      
      // Disable source maps completely
      webpackConfig.devtool = false;
      
      // Minimal optimization for development
      if (env === 'development') {
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          removeAvailableModules: false,
          removeEmptyChunks: false,
          splitChunks: false,
        };
      }
      
      return webpackConfig;
    },
  },
  devServer: {
    client: {
      overlay: false,
      logging: 'none',
    },
    compress: false,
    historyApiFallback: true,
    hot: false,
    liveReload: false,
  }
};
