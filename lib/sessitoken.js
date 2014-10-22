'use strict';
var FileStore = require('./filestore'),
  tokenGenerator = require('./tokengenerator'),
  _ = require('lodash');
var MongoStore = require('./mongostore');

var standardOptions = {
  duration: 20 * 60 * 1000,
  activeDuration: 5 * 60 * 1000
};

function SessiToken(options) {
  this.options = _.merge(standardOptions, options || {});
  if(!this.options.store) {
    this.options.store = new FileStore(this.options);
  }
  this.options.store.duration = this.options.duration;
  this.options.store.activeDuration = this.options.activeDuration;

  this.requestHandler = this.requestHandler.bind(this);
}

SessiToken.prototype.getKey = function(req) {
  if(this.options.token && req.headers && req.headers[this.options.token]) {
    return req.headers[this.options.token];
  } else if(this.options.cookie && req.cookies && req.cookies[this.options.cookie]) {
    return req.cookies[this.options.cookie];
  } else {
    return;
  }
};

SessiToken.prototype.requestHandler = function(req, res, next) {
  var self = this,
    key = this.getKey(req);

  if(key) {
    if(this.options.token) { req[this.options.token] = key; }

    this.options.store.get(key)
      .done(function (value) {
        req.session = value.data;
        res.on('finish', self.onResponseFinish.bind(self, key, req, JSON.stringify(req.session)));
        return next();
      }, function (err) {
        // error should be handled outside of promise chain
        throw err;
      });
  } else {
    key = tokenGenerator.generate();
    if(this.options.cookie) {
      res.setHeader('Set-Cookie', [this.options.cookie + '=' + key]);
    }
    if(this.options.token) { req[this.options.token] = key; }
    req.session = {};
    res.on('finish', self.onResponseFinish.bind(self, key, req, JSON.stringify(req.session)));
    return next();
  }
};

SessiToken.prototype.onResponseFinish = function(key, req, originalSession) {
  if(JSON.stringify(req.session) !== originalSession) {
    this.options.store.update(key, req.session);
  } else {
    this.options.store.update(key);
  }
};

module.exports = {
  MongoStore: MongoStore,
  FileStore: FileStore,
  sessitoken: function (opts) {
    var sessiToken = new SessiToken(opts);
    return sessiToken.requestHandler;
  }
};