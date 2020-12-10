const { merge } = require('webpack-merge');
const CopyPkgJsonPlugin = require('copy-pkg-json-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

function srcPaths(src) {
  return path.resolve(__dirname, src);
}

const isEnvProduction = process.env.NODE_ENV === 'production';
const isEnvDevelopment = process.env.NODE_ENV === 'development';

// #region Common settings
const commonConfig = {
  devtool: isEnvDevelopment ? 'source-map' : false,
  mode: isEnvProduction ? 'production' : 'development',
  output: { path: srcPaths('dist') },
  node: { __dirname: false, __filename: false },
  resolve: {
    alias: {
      '@': srcPaths('src'),
      '@main': srcPaths('src/main'),
      '@models': srcPaths('src/models'),
      '@public': srcPaths('public'),
      '@renderer': srcPaths('src/renderer'),
      '@utils': srcPaths('src/utils'),
      '@assets': srcPaths('assets'),
      'monaco-editor': 'monaco-editor/esm/vs/editor/editor.api'
    },
    extensions: ['.js', '.json', '.ts', '.tsx']
  },
  optimization: {
    minimize: true,
    minimizer: [
      // new TerserPlugin()
    ]
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'ts-loader'
      },
      {
        test: /\.scss$/,
        exclude: /node_modules/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader']
      },
      {
        test: /\.css$/,
        include: /node_modules/,
        use: ['style-loader', 'css-loader']
      },
      { test: /\.json$/, loader: 'json', include: '/assets/' },
      {
        test: /\.(jpg|png|svg|ico|icns)$/,
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]'
        }
      },
      {
        test: /\.ttf$/,
        use: ['file-loader']
      }
    ]
  }
};
// #endregion

const mainConfig = merge(commonConfig, {
  entry: './src/main/main.ts',
  target: 'electron-main',
  output: {
    filename: 'main.bundle.js'
  },
  plugins: [
    new CopyPkgJsonPlugin({
      remove: ['scripts', 'devDependencies', 'build'],
      replace: {
        main: './main.bundle.js',
        scripts: { start: 'electron ./main.bundle.js' },
        postinstall: 'electron-builder install-app-deps'
      }
    })
  ]
});

const rendererConfig = merge(commonConfig, {
  entry: './src/renderer/renderer.tsx',
  target: 'electron-renderer',
  output: {
    filename: 'renderer.bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './public/index.html')
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new MonacoWebpackPlugin({
      languages: []
    })
  ]
});

module.exports = [mainConfig, rendererConfig];
