const mongoose = require('mongoose');

module.exports = function(){
	mongoose.connect('mongodb://localhost:27017/crawler');
	const db = mongoose.connection;
	require('./model/crawler.server.model');
	db.once('open', (callback) => {
		console.log('MongoDB连接成功！！')
	})
	return db;
}