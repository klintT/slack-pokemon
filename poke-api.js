var request = require('request'),
    Q = require('q'),
    Pokedex = require('pokedex-promise-v2'),
    P = new Pokedex({
      protocol: 'https',
      hostName: 'pokeapi.co:443',
      versionPath: '/api/v2/',
      timeout: 60 * 1000
    });

module.exports = {}

module.exports.getPokemon = function(name) {
  return Q(
    P.getPokemonByName(name)
      .then(function (pkdata) {
        for (i = 0; i < pkdata.stats.length; i++) {
          var statObj = pkdata.stats[i];
          if (statObj.stat.name == "hp") {
            pkdata.hp = statObj.base_stat;
          } else if (statObj.stat.name == "attack") {
            pkdata.attack = statObj.base_stat;
          } else if (statObj.stat.name == "defense") {
            pkdata.defense = statObj.base_stat;
          } else if (statObj.stat.name == "special-attack") {
            pkdata.sp_attack = statObj.base_stat;
          } else if (statObj.stat.name == "special-defense") {
            pkdata.sp_defense = statObj.base_stat;
          }
        }
        pkdata.default_sprite = pkdata.sprites.front_default;
        console.log("pokemon found: ", pkdata);
        return pkdata;
      })
      .catch(function(error) {
        console.log(error);
        throw new new Error("Error Getting Pokemon: " + name);
      })
    );
}

module.exports.getSprite = function(url) {
  var deferred = Q.defer();
  request(url, function (error, response, body) {
    if (response.statusCode == 200) {
      deferred.resolve(JSON.parse(body));
    } else {
      deferred.reject(new Error("Error Getting Sprite"));
    }
  })
  return deferred.promise;
}

module.exports.getMove = function(name) {
  return Q(
    P.getMoveByName(name)
      .then(function (data) {
        return data;
      })
      .catch(function(error) {
        console.log(error);
        throw new Error("Error Getting Move");
      })
  );
}

/*
* Calculates the effectiveness of one move on a pokemon with 1 or 2 types.
* When accessing a move from the API, it will return with three arrays that look like this:
* "super_effective": [{name:"fairy", resource_uri:"/api/v1/type/18"} ... ]
* We only care about the name, so we map these arrays to something like:
* supereffective = ["fairy", "ice", ...]
* then we can go through and calculate the damage multiplier based on the three arrays.
*/
module.exports.getAttackMultiplier = function(offensive, defensive1, defensive2) {
  var multiplier = 1;

  return Q(
    P.getTypeByName(offensive.toLowerCase())
      .then(function(typeData) {
        var d = typeData,
            ineffective = d.damage_relations.half_damage_to.map(function(val){return val.name}),
            noeffect = d.damage_relations.no_damage_to.map(function(val){return val.name}),
            supereffective = d.damage_relations.double_damage_to.map(function(val){return val.name});
        [defensive1, defensive2].forEach(function(type){
          if(ineffective.indexOf(type) !== -1) { multiplier *= 0.5; }
          if(noeffect.indexOf(type) !== -1) { multiplier *= 0; }
          if(supereffective.indexOf(type) !== -1) { multiplier *= 2; }
        });

        return multiplier;
      })
      .catch(function(error) {
        console.log(error);
        throw new Error("Error accessing API while getting type.");
      })
    );
}