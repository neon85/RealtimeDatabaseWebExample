// const MODE = "production";
const MODE = "development";

// const enabledSourceMap = MODE === "development";

module.exports = {
  mode: MODE,
  entry: {
    index: './src/index.ts',
    signup: './src/signup.ts',
    login: './src/login.ts',
    user_presence: './src/user_presence.ts',
    realtime_database: './src/realtime_database.ts',
    database_pagination: './src/database_pagination.ts',
    chat_room_list: "./src/chat_room_list.ts",
    chat_room: "./src/chat_room.ts",
    user_info: "./src/user_info.ts",
    // react_test: "./src/chat_room/main.tsx"
  },
  output: {
    path: `${__dirname}/dist/js`,
    filename: '[name].js'
  },
  devtool: 'inline-source-map',
  module: {
    rules: [{
      test: /\.(js|ts)x?$/,
      use: 'babel-loader',
      exclude: /node_modules/
    }]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js']
  }
}