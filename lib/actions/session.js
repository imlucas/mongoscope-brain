var debug = require('debug')('mongoscope-brain:actions:session'),
  config = require('mongoscope-config'),
  uuid = require('uuid'),
  async = require('async'),
  connect = require('../connect');

function generateId(fn) {
  process.nextTick(function() {
    fn(null, uuid.v4());
  });
}

var _reapers = {},
  _connections = {};

function destroySession(sessionId, fn) {
  if (_connections[sessionId]) {
    _connections[sessionId].close();
    _connections[sessionId] = undefined;
    debug('reaped connection for session %s', sessionId);
  }
  destroyReaper(sessionId);
  if (fn) return fn();
}

function destroyReaper(sessionId) {
  if (_reapers[sessionId]) {
    clearTimeout(_reapers[sessionId]);
    _reapers[sessionId] = undefined;
    debug('destroyed reaper for session %s', sessionId);
  }
}

function createReaper(sessionId) {
  var timeout = config.get('token:lifetime') * 60 * 1000 + 1000,
    reap = destroySession.bind(null, sessionId);

  _reapers[sessionId] = setTimeout(reap, timeout);
  debug('created reaper for session %s', sessionId);
}

module.exports.create = function(url, opts, fn) {
  async.series({
    connection: function(cb) {
      connect(url, opts, cb);
    },
    sessionId: generateId
  }, function(err, res) {
      if (err) {
        return fn(err);
      }
      // @todo: need a session or token model...
      _connections[res.sessionId] = res.connection;
      createReaper(res.sessionId);

      var session = {
        _id: res.sessionId,
        connection: res.connection
      };
      fn(null, session);
    });
};

module.exports.destroy = destroySession;

module.exports.get = function(sessionId, fn) {
  process.nextTick(function() {
    fn(null, _connections[sessionId]);
  });
};
module.exports.exists = function(sessionId, fn) {
  process.nextTick(function() {
    fn(null, (_connections[sessionId] !== undefined));
  });
};
