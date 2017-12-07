var Player = require('./Player_mdl.js');
var Q = require('q');

var Game = function(gameId, player1, player2, channel) {
  self = this;
  self.gameId = gameId || null;
  self.player1 = player1 || null;
  self.player2 = player2 || null;
  self.channel = channel || null;

  self.addPlayer = function(type, playerName) {
    if(self.player1 == null) {
      self.player1 = Player.fromNameAndType(type, playerName);
      return self.player1;
    } else if (self.player2 == null) {
      self.player2 = Player.fromNameAndType(type, playerName);
      return self.player2;
    } else {
      throw new Error('Can\'t add player. Game is full.');
    }
  };

  self.getPlayerByName = function(playerName) {
    if(self.player1 != null && self.player1.name == playerName){
      return self.player1;
    } else if(self.player2 != null && self.player2.name == playerName) {
      return self.player2;
    } else {
      return self.addPlayer(false, playerName);
    }
  };

  self.createNpcTrainer = function() {
    return self.addPlayer(true, 'npc');
  };

  self.choosePokemon = function(playerName, pokemonData) {
     return Q(self.getPlayerByName(playerName).choosePokemon(pokemonData));
  };

  self.chooseNextPokemon = function(playerName) {
    return Q(self.getPlayerByName(playerName).chooseNextPokemon());
  };

  self.addAllowedMove = function(playerName, pokemonName, move) {
     return Q(self.getPlayerByName(playerName).addAllowedMove(pokemonName, move));
  };

  self.getActivePokemon = function(playerName) {
    return Q(self.getPlayerByName(playerName).getActivePokemon());
  }

  self.getActivePokemonTypes = function(playerName) {
    return Q(self.getPlayerByName(playerName).getActivePokemonTypes());
  };

  self.getActivePokemonAllowedMoves = function(playerName){
    return Q(self.getPlayerByName(playerName).getActivePokemonAllowedMoves());
  };

  self.damageActivePokemon = function(playerName, damage) {
    return Q(self.getPlayerByName(playerName).damageActivePokemon(damage));
  };
};

Game.prototype = new Game();
Game.prototype.constructor = Game;

module.exports.fromName = function(name) {
  return new Game(name);
};

module.exports.fromJSON = function(json) {
  return new Game(json.gameId, Player.fromJSON(json.player1), Player.fromJSON(json.player2), json.channel);
};
