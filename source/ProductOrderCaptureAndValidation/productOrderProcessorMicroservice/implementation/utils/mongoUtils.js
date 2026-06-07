'use strict';

const MongoClient = require('mongodb').MongoClient;

var mongodb = null;

/**
 * Connect to MongoDB using environment variables
 * @returns {Promise} Promise that resolves with the database connection
 */
function connect() {
  return new Promise((resolve, reject) => {
    if (mongodb) {
      resolve(mongodb);
      return;
    }

    const database = process.env.MONGODB_DATABASE || 'tmf';
    const host = process.env.MONGODB_HOST || 'localhost';
    const port = process.env.MONGODB_PORT || '27017';
    const credentials_uri = `mongodb://${host}:${port}/${database}`;
    
    let options = {
      useNewUrlParser: true,
      useUnifiedTopology: true
    };

    console.log(`Connecting to MongoDB at ${host}:${port}/${database}`);
    
    MongoClient.connect(credentials_uri, options, function (err, db) {
      if (err) {
        console.error('MongoDB connection error:', err);
        mongodb = null;
        reject(err);
      } else {
        mongodb = db.db(database);
        console.log('MongoDB connected successfully');
        resolve(mongodb);
      }
    });
  });
}

/**
 * Close MongoDB connection
 */
function close() {
  if (mongodb) {
    mongodb.close();
    mongodb = null;
    console.log('MongoDB connection closed');
  }
}

module.exports = {
  connect,
  close
};
