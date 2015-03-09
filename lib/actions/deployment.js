var async = require('async'),
  _ = require('underscore'),
  debug = require('debug')('mongoscope-brain:actions:deployment'),
  store = require('../store'),
  discover = require('../discover'),
  connect = require('../connect'),
  types = require('../types');

var squash = function(deployment, fn) {
  var ids = _.pluck(deployment.instances, '_id'),
    squish = [];

  store.all(function(err, docs) {
    if (err) return fn(err);

    docs.map(function(doc) {
      // Skip current
      if (doc._id === deployment._id) return;

      var res = _.chain(doc.instances)
        .pluck('_id')
        .filter(function(id) {
          return ids.indexOf(id) > -1;
        })
        .value();

      if (res.length > 0) {
        squish.push(doc);
      }
    });
    // nothing to squish
    if (squish.length === 0) return fn();

    debug('squishing', squish);
    async.parallel(squish.map(function(d) {
      return function(cb) {
        store.remove(d._id, function(err) {
          cb(err);
        });
      };
    }), function(err) {
        fn(err, squish);
      });
  });
};

module.exports.create = function(_id, opts, fn) {
  opts = opts || {};
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }

  var deployment = {
    name: '',
    _id: _id,
    instances: []
  };

  connect(_id, opts, function(err, conn) {
    if (err) return fn(err);
    if (!conn) return fn(new Error('could not connect'));

    deployment.name = types.url(_id).name;

    discover(conn, function(err, res) {
      if (err) {
        conn.close();
        return fn(err);
      }

      deployment.instances = res.instances;
      deployment.sharding = res.sharding;

      conn.close();
      squash(deployment, function() {
        fn(null, deployment);
      });
    });
  });
};

// @note: Deployment.resolve merged into .get.
module.exports.get = function(id, opts, fn) {
  if (typeof opts === 'function') {
    fn = opts;
    opts = fn;
  }

  var deployment;

  store.get(id, function(err, dep) {
    deployment = dep;

    if (err || deployment) return fn(err, deployment);

    store.all(function(err, docs) {
      if (err) return fn(err);

      docs.map(function(doc) {
        doc.instances.map(function(instance) {
          if (instance._id === id && !deployment) {
            deployment = doc;
          }
        });
      });
    });
    fn(null, deployment);
  });
};
