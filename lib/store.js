var debug = require('debug')('mongoscope-brain:store'),
  _ = require('underscore');

// @todo: use an underscorejs collection for the query guts as it already has
// all of the filtering/grouping/etc.

var store_data = {},
  store_keys = [];

var store = module.exports = {
  keys: function(fn) {
    fn(null, store_keys);
  },
  key: function(fn) {
    fn(null, store_keys.length);
  },
  get: function(key, fn) {
    fn(null, store_data[key]);
  },
  remove: function(key, fn) {
    delete store_data[key];
    store_keys.splice(store_keys.indexOf(key), 1);
    return fn();
  },
  find: function(query, fn) {
    var keys = Object.keys(query);
    if (keys.length === 0) {
      return fn(null, store_keys.map(function(k) {
        return store_data[k];
      }));
    }

    var docs = [];
    store_keys.map(function(k) {
      var item = store_data[k];

      keys.every(function(_k) {
        if (item[_k]) {
          docs.push(item);
        }
      });
    });
    fn(null, docs);
  },
  clear: function(fn) {
    debug('clearing deployment store');
    store.find({}, function(err, docs) {
      if (err) return fn(err);
      if (docs.length === 0) return fn();

      var pending = docs.length;
      docs.map(function(doc) {
        store.remove(doc._id, function() {
          pending--;
          if (pending === 0) return fn();
        });
      });
    });
  },
  set: function(key, val, fn) {
    store_data[key] = val;
    if (store_keys.indexOf(key) === -1) {
      store_keys.push(key);
    }
    fn();
  },
  all: function(fn) {
    fn(null, _.values(store_data));
  }
};
