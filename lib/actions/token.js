var config = require('mongoscope-config'),
  jwt = require('jsonwebtoken'),
  boom = require('boom'),
  debug = require('debug')('mongoscope-brain:token');

var getDeployment = require('./deployment').get;
var createSession = require('./session').create;


function verify(token, fn) {
  jwt.verify(token, config.get('token:secret').toString('utf-8'), function(err, data) {
    if (err) {
      debug('invalid token', err.message);
      return fn(boom.forbidden(err.message));
    }

    fn(null, data);
  });
}

module.exports.load = function(token, ctx, next) {
  verify(token, function(err, data) {
    if (err) return next(err);

    if (!data.session_id) {
      return next(boom.badRequest('Bad token: missing session id'));
    }

    if (!data.deployment_id) {
      return next(boom.badRequest('Bad token: missing deployment_id'));
    }

    ctx.session_id = data.session_id;

    debug('token validated for deployment', data.deployment_id);

    getDeployment(data.deployment_id, function(err, deployment) {
      if (err) return next(err);
      if (!deployment) {
        return next(boom.badRequest('Bad token: deployment not found'));
      }

      ctx.deployment = deployment;
      if (ctx.instance_id) {
        debug('looking up instance', ctx.instance_id);

        ctx.instance = deployment.getInstance(ctx.instance_id);

        if (!ctx.instance) {
          return next(boom.forbidden('Tried getting a connection ' +
          'to `' + ctx.instance_id + '` but it is not in ' +
          'deployment `' + data.deployment_id + '`'));
        }

        debug('getting connection for session', data.session_id);
        ctx.mongo = ctx.instance.getConnection(data.session_id);
        return next();
      } else {
        deployment.getSeedConnection(function(err, db) {
          if (err) return next(err);
          ctx.mongo = db;
          next();
        });
      }
    });
  });
};

// @todo: this should live in actions/token or session?
module.exports.create = function(ctx, fn) {
  var payload = {
      deployment_id: ctx.deployment._id,
      session_id: undefined
    },
    opts = {
      expiresInMinutes: config.get('token:lifetime')
    },
    secret = config.get('token:secret').toString('utf-8'),
    token = jwt.sign(payload, secret, opts),
    now = Date.now();

  debug('token payload', payload);

  // Connection options for MongoClient
  var connectionOpts = {
    auth: ctx.auth,
    timeout: ctx.timeout
  };

  createSession(ctx.seed, connectionOpts, function(err, session) {
    if (err) return fn(err);
    payload.session_id = session._id;
    ctx.session_id = session._id;

    fn(null, {
      token: token,
      deployment_type: ctx.deployment.getType(),
      deployment_id: ctx.deployment._id,
      instance_id: ctx.instance_id,
      id: ctx.session_id,
      expires_at: new Date(now + (config.get('token:lifetime') * 60 * 1000)),
      created_at: new Date(now)
    });
  });
};
