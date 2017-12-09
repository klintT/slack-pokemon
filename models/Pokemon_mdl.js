var Pokemon = function(dex_no, name, allowedMoves, types, hp, attack, defense, sp_attack, sp_defense, speed, sprite) {
  this.id = dex_no || 0;
  this.name = name || null;
  this.hp = hp || 0;
  this.allowedMoves = allowedMoves || [];
  this.types = types || [];

  this.attack = attack || null;
  this.defense = defense || null;
  this.sp_attack = sp_attack || null;
  this.sp_defense = sp_defense || null;
  this.speed = speed || null;
  this.default_sprite = sprite || null;

  this.addAllowedMove = function(move) {
    return this.allowedMoves.push(move);
  };
};

Pokemon.prototype = new Pokemon();
Pokemon.prototype.constructor = Pokemon;

module.exports.blank = function() {
  return new Pokemon();
};

module.exports.fromPokeData = function(pokemonData) {
  return new Pokemon(
    pokemonData.id,
    pokemonData.name,
    [],
    pokemonData.types,
    pokemonData.hp,
    pokemonData.attack,
    pokemonData.defense,
    pokemonData.sp_attack,
    pokemonData.sp_defense,
    pokemonData.speed,
    pokemonData.default_sprite
  );
};

module.exports.fromJSON = function(json) {
  return new Pokemon(
    json.id,
    json.name,
    json.allowedMoves,
    json.types,
    json.hp,
    json.attack,
    json.defense,
    json.sp_attack,
    json.sp_defense,
    json.speed,
    json.default_sprite
  );
};
