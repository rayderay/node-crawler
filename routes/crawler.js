var express = require('express');
var router = express.Router();
var cheerio = require('cheerio');
var superagent = require('superagent');
var async = require('async');
var eventproxy = require('eventproxy');
var ep = eventproxy();
var moment = require('moment');
var mongoose = require('mongoose');

var CrawlerList = mongoose.model('crawlerList');
var baseUrl = 'http://www.cnblogs.com/?CategoryId=808&CategoryType=%22SiteHome%22&ItemListActionName=%22PostList%22&PageIndex=';
var pageUrls = [],//收集文章页面网站
	deleteRepeat = {} ,
	urlsArray = [] ,//存放爬取网站
	catchDate = [], //存放爬取数据
	StartDate = new Date().getTime(),//开始时间
	EndDate = false ; //结束时间

// 抓取昵称、入园年龄、粉丝数、关注数
function personInfo(url){
	var infoArray = {};
	superagent.get(url)
		.end(function(err,ares){
			if (err) {
	      console.log(err);
	      return;
	    }

	    var $ = cheerio.load(ares.text),
			info = $('#profile_block a'),
			len = info.length,
			joinData = "",
			flag = false,
			curDate = new Date();

  	  	// 小概率异常抛错	
		try{
			joinData = "20"+(info.eq(1).attr('title').split('20')[1]);
		}
		catch(err){
			console.log(err);
			joinData = "2012-11-06";
		}	

    	infoArray.name = info.eq(0).text();
    	infoArray.joinData = parseInt((new Date() - new Date(joinData))/1000/60/60/24);
	    
	    if(len == 4){
	 	    infoArray.fans = info.eq(2).text();
	    	infoArray.focus = info.eq(3).text();	
	    }else if(len == 5){// 博客园推荐博客
	 	    infoArray.fans = info.eq(3).text();
	    	infoArray.focus = info.eq(4).text();	
	    }
	    //console.log('用户信息:'+JSON.stringify(infoArray));
	    catchDate.push(infoArray);
	});
}

// 判断作者是否重复
function isRepeat(authorName){
	if(deleteRepeat[authorName] == undefined){
		deleteRepeat[authorName] = 1;
		return 0;
	}else if(deleteRepeat[authorName] == 1){
		return 1;
	}
}

router.post('/getCrawler',function(req, res, next){
	var pageNum = req.body.pageNum;
	for( var _i = 1; _i <= pageNum ; _i++){ //
		pageUrls.push(baseUrl + _i + '&ParentCategoryId=0');
	};
	pageUrls.forEach(function(pageUrl){
		superagent.get(pageUrl)
			.end(function(err,pres){
				console.log('fetch ' + pageUrl + ' successful');
				//res.write('fetch ' + pageUrl + ' successful<br/>');
				// 常规的错误处理
		  if (err) {
				console.log(err);
			}
		  // pres.text 里面存储着请求返回的 html 内容，将它传给 cheerio.load 之后
		  // 就可以得到一个实现了 jquery 接口的变量，我们习惯性地将它命名为 `$`
		  // 剩下就都是 jquery 的内容了
		  var $ = cheerio.load(pres.text);
		  var curPageUrls = $('.titlelnk');
		  for(var i = 0 ; i < curPageUrls.length ; i++){
			  var articleUrl = curPageUrls.eq(i).attr('href');
			  urlsArray.push(articleUrl);
			  // 相当于一个计数器
			  ep.emit('BlogArticleHtml', articleUrl);
		  }
		})
	});

	ep.after('BlogArticleHtml', pageUrls.length*20, function(articleUrls){
		
		console.log('articleUrls.length is'+ articleUrls.length +',content is :'+articleUrls);
		var curCount = 0;
		var reptileMove = function(url,callback){
			var delay = parseInt((Math.random() * 30000000) % 1000, 10);
			curCount++;
			console.log('现在的并发数是', curCount, '，正在抓取的是', url, '，耗时' + delay + '毫秒');
			superagent.get(url)
		  		.end(function(err,sres){
				// 常规的错误处理
				if (err) {
					console.log(err);
					return;
				}		  	

				//sres.text 里面存储着请求返回的 html 内容
				var $ = cheerio.load(sres.text);
				//收集数据
				//1、收集用户个人信息，昵称、园龄、粉丝、关注
				//var currentBlogApp = $('script').eq(1).text().split(',')[0].split('=')[1].trim().replace(/'/g,""),
				var currentBlogApp = url.split('/p/')[0].split('/')[3],	
					requestId = url.split('/p/')[1].split('.')[0];

				//res.write('currentBlogApp is '+ currentBlogApp + ' , ' + 'requestId id is ' + requestId +'<br/>'); 
				console.log('currentBlogApp is '+ currentBlogApp + '\n' + 'requestId id is ' + requestId); 

				//res.write('the article title is :'+$('title').text() +'<br/>');

				var flag = 	isRepeat(currentBlogApp);
				
				if(!flag){
						var appUrl = "http://www.cnblogs.com/mvc/blog/news.aspx?blogApp="+ currentBlogApp;
						personInfo(appUrl);
					};
				});

			setTimeout(function() {
				curCount--;
				callback(null,url +'Call back content');
			}, delay);	
		  
		};
		async.mapLimit(articleUrls, 5 ,function (url, callback) {
			reptileMove(url, callback);
		  }, function (err,result) {
			EndDate = new Date().getTime();

			console.log('final:');
			console.log(catchDate);
			var len = catchDate.length,
				aveData = 0,
				aveFans = 0,
				aveFocus = 0;

			for(var i=0 ; i<len ; i++){
				var eachDate = JSON.stringify(catchDate[i]),
					eachDateJson = catchDate[i];
				var newlist = new CrawlerList();
				newlist = catchDate[i];
				//存入数据库
				CrawlerList.create(newlist,(err) => {
					if(err) return console.log(err);
				})
				// 小几率取不到值则赋默认值	
				eachDateJsonFans = eachDateJson.fans || 110;
				eachDateJsonFocus = eachDateJson.focus || 11;
					
				aveData += parseInt(eachDateJson.joinData);
				aveFans += parseInt(eachDateJsonFans);
				aveFocus += parseInt(eachDateJsonFocus); 
			}
			var startDate =  moment(StartDate);
			var endDate =  moment(EndDate);
			var costTime = endDate.diff(startDate)

			var result = {
				succeed: true,
				errorCode: '0000000',
				errorMessage: '成功',
				data:{
					startDate:  moment(StartDate).format('YYYY-MM-DD HH:mm:ss.SS'),
					endDate: moment(EndDate).format('YYYY-MM-DD HH:mm:ss.SS'),
					costTime: costTime/1000+'s',
					pageNum: pageNum * 20,
					len: len,
					joinData: Math.round(aveData/len*100)/100,
					aveFans:  Math.round(aveFans/len*100)/100,
					aveFocus: Math.round(aveFocus/len*100)/100
				} 
			}
			res.json(result)
			
		  });
	});
	

});

router.get('/dbList',function(req,res,next){

	CrawlerList.find({}, function(err, docs){
		if(err){
			res.end('Error');
			return next();
		}
		res.json(docs);
	})
})

module.exports = router;