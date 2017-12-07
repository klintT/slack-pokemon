var moves = require('./file-system.js'),
    Game = require('./models/Game_mdl.js'),
    Q = require('q');

/* For using RedisToGo on Heroku. If you're not using RedisToGo or Heroku,
* feel free to remove this part and just use
* redis = require("redis").createClient();
*/
var redis, redisUrl = process.env.REDISTOGO_URL || process.env.REDIS_URL;
if(redisUrl) {
  var {URL} = require("url")
  var rtg   = new URL(redisUrl);
  redis = require("redis").createClient(rtg.port, rtg.hostname);

  if (rtg.auth) {
    redis.auth(rtg.password);
  }
} else {
  //then we're running locally
  redis = require("redis").createClient();
}

/* Turn Redis Methods Into Promise-returning Ones */
QRedis = {};
QRedis.exists = Q.nbind(redis.exists, redis);
QRedis.set = Q.nbind(redis.set, redis);
QRedis.get = Q.nbind(redis.get, redis);
QRedis.del = Q.nbind(redis.del, redis);
QRedis.hmset = Q.nbind(redis.hmset, redis);
QRedis.hgetall = Q.nbind(redis.hgetall, redis);

module.exports = {};

module.exports.newBattle = function(playerName, channel) {
  var tryStartGame = function(exists) {
    if(!exists) {
      return getGameObj(playerName).then( createNewGame );
    } else {
      throw new Error("Battle exists");
    }
  };

  var createNewGame = function(game) {
    game.id = playerName;
    game.channel = channel;
    return game;
  };

  return QRedis.exists(playerName)
  .then( tryStartGame );
}

module.exports.getBattle = function(playerName) {
  return getGameObj(playerName);
}

module.exports.saveGame = function(game) {
  return saveGame( game );
}

module.exports.endBattle = function(playerName) {
  return QRedis.del( playerName )
}


/////////////////////////////////////////
//       Private Methods            /////
/////////////////////////////////////////

function getGameObj(playerName) {
  var _getGame = function() {
    return QRedis.get(playerName);
  },

  formGameObject = function(json) {
    var game = Game.fromName(playerName);
    if(json) {
      game = Game.fromJSON(JSON.parse(json));
    }

    return game;
  };

  return  _getGame()
  .then( formGameObject );
}

function saveGame(game) {
  return QRedis.set(game.gameId, JSON.stringify(game))
};

function cacheMove(name, data){
  return QRedis.hmset("move:"+name,{
    "power": data.power,
    "accuracy": data.accuracy,
    "pp": data.pp,
    "description": data.description,
    "type": moves.getMoveType(name)
  });
}
