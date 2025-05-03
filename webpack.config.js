const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require('path');

module.exports = {
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,      // 👈 handles both .js and .jsx
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'graph', // unique name for your app
      filename: 'remoteEntry.js',
      exposes: {
        './Home': './src/App.jsx', // 👈 exposed module
      },
      shared: {
        react: {
          singleton: true,
          eager: true,
          requiredVersion: '^18.3.1',
        },
        'react-dom': {
          singleton: true,
          eager: true,
          requiredVersion: '^18.3.1',
        },
      }
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: './index.html',
    }),
  ],
  devServer: {
    port: 3003,
  },
  resolve: {
    extensions: ['.js', '.jsx'], // 👈 lets you import without extensions
  },
  output: {
    publicPath: 'auto',
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
};
