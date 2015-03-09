var types = require('./types'),
  sharding = require('./sharding'),
  replicaset = require('./replicaset');

/**
 * Weave our way through to find all of the instances in a deployment.
 *
 * @todo: handle dynamic updates (new members, state changes) and
 * update the deployment store
 */
module.exports = function discover(db, fn) {
  // @todo: isMongos() function moved?
  // if (db.serverConfig.isMongos()) {
  //   return sharding.discover(db, fn);
  // }

  // We're in a replset
  if (db.serverConfig.s.replset) {
    return replicaset.discover(db, fn);
  }

  var p = db.serverConfig.socketOptions;
  return fn(null, {
    instances: [types.url(p.host + ':' + p.port).toJSON()]
  });
};
