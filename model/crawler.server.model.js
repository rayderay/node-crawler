var express = require('express');
var mongoose = require('mongoose');

var crawlerListSchema = new mongoose.Schema({
	name: String ,
	joinData: Number,
	fans: String ,
	focus: String
})
var CrawlerList = mongoose.model('crawlerList', crawlerListSchema,'CrawlerList');

module.exports = CrawlerList

