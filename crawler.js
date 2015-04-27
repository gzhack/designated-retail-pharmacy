var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');

// schema 里面定义了每一个 field 的 CSS selector (以后还可以支持有别的东西，比如一个 transformer 或者正则表达式)
var schema = {
  "单位名称": ["div.mima03 > table > tbody > tr:nth-child(1n + 2) > td:nth-child(2)"],
  "地址": ["div.mima03 > table > tbody > tr:nth-child(1n + 2) > td:nth-child(3)"],
  "行政区": ["div.mima03 > table > tbody > tr:nth-child(1n + 2) > td:nth-child(4)"]
};

var keys = _.keys(schema);

// API Base
var url = 'http://www.gzyb.net/infoquery/QueryDdlsydData.action';

async.waterfall([
  // http 请求
  function(callback) {
    request({
      url: url,
      formData: {
        pageSize: 10000,
        pageNo: 1
      },
      encoding: null
    }, callback);
    
  // 将 buffer 进行必要的转码 (如将 gbk 转换成 utf8)
  }, function(res, body, callback) {
    if (res.statusCode != 200) return callback(new Error(res.statusCode));
    var isGBK = res.headers['content-type'].toUpperCase().indexOf('GBK')>-1;

    callback(null, isGBK?iconv.decode(body, 'GBK'):body.toString());
    
  // 解析 html ，将数据提取出来
  }, function(html, callback) {
    var $ = cheerio.load(html);

    var result = {};

    _.forEach(schema, function(config, key) {
      var selector = config[0];
      result[key] = $(selector).map(function(i, el) {
        var f = config[1];
        if (f) return f($(el));
        return $(el).text().trim();
      }).get();
    });

    return callback(null, _.map(result[keys[0]], function(val, index) {
        var row = {};
        _.forEach(keys, function(key) {
          row[key] = result[key][index];
        });
        return row;
      }));
  }], function(err, data) {
    if (err) return console.dir(err);

    // 添加一些 metadata
    var result = {
      timeUpdated: Date.now(),
      count: data.length,
      result: data
    };

    // 写入 data.json
    fs.writeFile('data.json', JSON.stringify(result, null, 2), function(err) {
      if (err) return console.dir(err);
      console.log('success');
    });
  });
