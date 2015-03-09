var boom = require('boom'),
  Token = require('./token');

module.exports.tokenRequired = function(req, res, next) {
  var access_token,
    auth = req.headers.authorization || '',
    parts = auth.split(' ');

  if (req.method === 'POST' && req.url === '/api/v1/token') return next();

  if (!auth) return next(boom.notAuthorized('Missing authorization header'));

  access_token = parts[1];

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(boom.badRequest('Authorization header malformed.'));
  }

  if (access_token === 'undefined') {
    return next(boom.badRequest('Access token is the string `undefined`'));
  }

  if (req.param('instance_id')) {
    req.instance_id = req.param('instance_id');
  }

  Token.load(access_token, req, next);
};
