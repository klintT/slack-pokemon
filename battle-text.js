var pokeapi = require('./poke-api.js');
var stateMachine = require('./state-machine.js');
var moves = require('./file-system.js');
var Q = require('q');

module.exports = {}

/*
 * Return a text string when the battle starts.
 * Stores the player's Slack username and what channel the battle is in,
 * and chooses a Pokemon for the NPC from the original 151.
 */
module.exports.startBattle = function(slackData) {
  var textString = "OK {name}, I'll battle you! ".replace("{name}", slackData.user_name);
  var pokeChoice;
  var game;
  var dex_nos = [];

  var getNpcDexNumbers = function(_game) {
    game = _game;

    var morePokeOdds = .3;

    do {
      var dex = Math.ceil(Math.random() * 151);
      dex_nos.push(dex);

      morePokeOdds += Math.random();
    } while(morePokeOdds < 1)

    return dex_nos;
  },

  createNpcTrainer = function() {
    return game.createNpcTrainer();
  },

  chooseNpcPokemon = function(trainer) {
    return module.exports.choosePokemon(game, trainer, dex_nos)
    .then( function( pkmnChoice ) { pokeChoice = pkmnChoice; } );
  },

  createNpcAnnouncement = function(){
    return {
      text: textString + '\n' + pokeChoice.text,
      spriteUrl: pokeChoice.spriteUrl
    }
  };

  return stateMachine.newBattle(slackData.user_name, slackData.channel_name)
  .then( getNpcDexNumbers )
  .then( createNpcTrainer )
  .then( chooseNpcPokemon )
  .then( createNpcAnnouncement )
}

/*
 * Return a text string when the user chooses a Pokemon.
 * Fetch the pokemon from the API, choose 4 random moves, write them to REDIS,
 * and then return a message stating the pokemon, its HP, and its moves.
 */
module.exports.choosePokemon = function(_game, _trainer, pokemon) {
  var game;
  var pokeData;
  var trainer;

  var getGame = function() {
    if( typeof _game === 'object' ) {
      game = _game;
      return game;
    } else {
      return stateMachine.getBattle( _game )
      .then( function( _gameObj ) { game = _gameObj; } )
    }
  },

  getTrainer = function() {
    if( typeof _trainer === 'object' ) {
      trainer = _trainer;
      return trainer;
    } else {
      trainer = game.getPlayerByName( _trainer );
    }
  },

  addAllPokemon = function() {
    var addPromises = [];
    for(var i = pokemon.length - 1; i > 0; i--) {
      addPromises.push(addPokemon(game, trainer, pokemon[i]));
    }

    var addActivePokemon = function() {
      return addPokemon(game, trainer, pokemon[0]);
    }

    return Q.all( addPromises )
    .then( addActivePokemon )
    .then( function (pkmnData) { pokeData = pkmnData; } )
  },

  setTextString = function(){
    var displayName = (trainer.isNpc) ? 'I choose' : trainer.name + ' chooses';
    var textString = "{chooseMessage} {pkmnn}. It has {hp} HP, {a} ATK, {d} DEF, {sa} SPATK, {sd} SPDEF and knows {moves}";

    textString = textString.replace("{chooseMessage}", displayName);
    textString = textString.replace("{pkmnn}", pokeData.name);
    textString = textString.replace("{hp}", pokeData.hp);
    textString = textString.replace("{a}", pokeData.attack);
    textString = textString.replace("{d}", pokeData.defense);
    textString = textString.replace("{sa}", pokeData.sp_attack);
    textString = textString.replace("{sd}", pokeData.sp_defense);
    textString = textString.replace("{moves}", pokeData.moveString);

    var spriteUrl = pokeData.default_sprite;

    return {
      text: textString,
      spriteUrl: spriteUrl
    }
  }

  saveGame = function() {
    return stateMachine.saveGame( game )
  };


  return Q( getGame() )
  .then( getTrainer )
  .then( addAllPokemon )
  .then( saveGame )
  .then( setTextString )
}

/*
 * When the user uses a move, calculate the results of the user's turn,
 * then the NPC's turn. If either one of them ends the battle, don't show
 * the other result.
 */
module.exports.doTurn = function(moveName, slackData) {
  var results = [];
  var game;

  var getGame = function() {
    return stateMachine.getBattle( slackData.user_name )
    .then(function( _game ) { game = _game; });
  },

  _decideMoves = function() {
    return decideMoves( game, moveName, results );
  },

  saveGame = function() {
    return stateMachine.saveGame( game );
  },

  checkForVictor = function () {
    if (results[0].loser || results[1].loser) {
      return stateMachine.endBattle(slackData.user_name)
    }
  },

  printResults = function(){
    var dmgText = results[0].text + "\n" + results[1].text;
    if(results[0].loser && results[1].loser) {
      return dmgText + '\nIt\'s a draw!';
    } else if(results[0].loser === slackData.user_name || results[1].loser === slackData.user_name) {
      return dmgText + '\nYou Lost!';
    } else if(results[0].loser === 'npc' || results[1].loser === 'npc') {
      return dmgText + '\nYou Beat Me!';
    } else {
      return dmgText;
    }
  };

  //TODO: Validate Move
  return getGame()
  .then( _decideMoves )
  .then( saveGame )
  .then( checkForVictor )
  .then( printResults )
}

/*
 * Return a text string when the command doesn't match defined commands.
 */
module.exports.unrecognizedCommand = function(cmd) {
  var textString = "I don't recognize the command _{cmd}_ .";
  textString = textString.replace("{cmd}", cmd);
  return Q(textString);
}

module.exports.endBattle = function(slackData) {
  return stateMachine.endBattle(slackData.user_name);
}


////////////////////////////////
//        Private Methods     //
////////////////////////////////

var decideMoves = function(game, moveName, results) {
  var faster;
  var slower;

  function prepMove(user) {
    //This works for now. Will need to be updated to support pvp
    var move = {
      'name': '',
      'isOpponent': false
    };

    if (user.isNpc) {
      move.name = null;
      move.isOpponent = true;
    } else {
      move.name = moveName;
      move.isOpponent = false;
    };

    return move;
  };

  var findFaster = function() {
    var poke1 = game.player1.getActivePokemon().speed;
    var poke2 = game.player2.getActivePokemon().speed;

    if(poke1 > poke2) {
      faster = game.player1;
      slower = game.player2;
    } else {
      faster = game.player2;
      slower = game.player1;
    }
  },

  doFasterMove = function() {
    var move = prepMove(faster);
    return useMove(move.name, game, faster.name, slower.name, move.isOpponent)
  },

  doSlowerMove = function() {
    var move = prepMove(slower);
    return useMove(move.name, game, slower.name, faster.name, move.isOpponent)
  },

  saveResult = function(result) {
    results.push(result)
    return result;
  },

  checkForFaint = function(result) {
    if (result.fainted) {
      return game.chooseNextPokemon( result.fainted.trainerName )
      .then(function(nextPoke) {
        if(nextPoke){
          result.text += '\n' + result.fainted.pokeName + ' fainted! \n';
          result.text += 'I choose '+ nextPoke.name +'! \n';
          result.text += nextPoke.default_sprite;//getSpriteUrl(nextPoke.id);
        } else {
          result.loser = result.fainted.trainerName;
        }
      });
    }
  };

  return Q( findFaster() )
  .then( doFasterMove )
  .then( saveResult )
  .then( checkForFaint )
  .then( doSlowerMove )
  .then( saveResult )
  .then( checkForFaint )
};

var saveGame = function(game) {
  return stateMachine.saveGame( game );
};

var addPokemon = function(game, trainer, pokemon) {
  var pkmnData;

  var getPokemonData = function(poke) {
    return pokeapi.getPokemon(poke)
  },

  choosePokemon = function(_pkmndata) {
    pkmnData = _pkmndata;
    return game.choosePokemon(trainer.name, pkmnData);
  },

  getMoveSet = function() {
    return getRandomMoveSet(
      pkmnData.moves.map(function (m) {
        return m.move;
      }), game, trainer.name, pkmnData.name)
    .then(function(moveString) {
      pkmnData.moveString = moveString;
      return pkmnData;
    });
  };

  return getPokemonData(pokemon)
  .then( choosePokemon )
  .then( getMoveSet )
};

function _getMoveFromPokeApi(moveList, i, totalMoves, maxMoves, game, trainerName, pokemonName) {
  if (i >= moveList.length) {
    return totalMoves.join(', ') + '.';
  }

  return pokeapi.getMove(moveList[i].name)
    .then(function (move) {
      var pchain = Q();
      //move.type = moves.getMoveType(move.name.toLowerCase());

      if (!move.power) {
        //console.log('Filtered out move: ', data);
        // Filter out moves that do no damage right now.
        // TODO: add back in later when effects are calculated
      } else {
        //console.log('adding move: ', data.name, 'power: ', data.power);
        pchain.then(function() { game.addAllowedMove(trainerName, pokemonName, move); });
        totalMoves.push(moveList[i].name + "[" + move.power + ":" + move.damage_class.name + ":" + move.type.name + "]");
      }

      if (totalMoves.length < maxMoves) {
        return pchain.then(function () {
          return _getMoveFromPokeApi(moveList, i + 1, totalMoves, maxMoves, game, trainerName, pokemonName)
        });
      } else {
        return pchain.then(function () { return totalMoves.join(', ') + '.'; });
      }
    });
}

function getRandomMoveSet(moveList, game, initPlayerName, pokemonName) {
  var textString = '';
  var moves = shuffle(moveList);

  return _getMoveFromPokeApi(moves, 0, [], 4, game, initPlayerName, pokemonName);
}

var effectivenessMessage = function(mult) {
  switch(mult) {
    case 0:
      return "It doesn't have an effect. ";
      break;
    case 0.5:
    case 0.25:
      return "It's not very effective... ";
      break;
    case 1:
      return " ";
      break;
    case 2:
    case 4:
      return "It's super effective! ";
      break;
    default:
      return " ";
      break;
  }
}

/*
 */
var useMove = function(move, game, trainerName, otherName, isOpponentMove) {
  var textString = "{txtPrep1} used {mvname}! {crit} {effctv}";
  var textStringDmg = "It did {dmg} damage, leaving {txtPrep2} with {hp}HP!";

  var getMoves = function() {
    return game.getActivePokemonAllowedMoves( trainerName );
  },

  getMove = function(moves){
    if (moves == null || moves.length <= 0) {
      throw new Error("No moves available; investigate why in code.");
    }

    if(move === null) {
      var rand = Math.min(Math.floor(Math.random() * 4), moves.length - 1);
      move = moves[rand];
      textString = textString.replace("{mvname}", move.name);
      return move;
    } else {
      var isAllowed = moves.filter(function(m) {
        return m.name.toLowerCase() == move;
      });

      if(isAllowed.length > 0) {
        textString = textString.replace("{mvname}", move);
        return isAllowed[0];
      } else {
        var moveStr = '';
        for(var m in moves) {
          moveStr += m.name + ', ';
        }
        moveStr = moveStr.splice(0, moveStr.length - 3);

        throw new Error("Your pokemon doesn't know that move. Your Moves: " + moveStr);
      }
    }
  },

  _doDamage = function(_move) {
    return doDamage(_move, game, trainerName, otherName);
  },

  formOutcomeText = function(results){
    var battleText;

    var txtPrep1 = (isOpponentMove) ? 'I' : 'You';
    var criticalMsg = (results.wasCritical) ? 'Critical Strike!' : '';
    textString = textString.replace("{txtPrep1}", txtPrep1);
    textString = textString.replace("{effctv}", effectivenessMessage(results.multiplier));
    textString = textString.replace("{crit}", criticalMsg);

    var txtPrep2 = (isOpponentMove) ? 'you' : 'me';
    textStringDmg = textStringDmg.replace("{txtPrep2}", txtPrep2);
    textStringDmg = textStringDmg.replace("{dmg}", results.damage);
    textStringDmg = textStringDmg.replace("{hp}", results.hpRemaining);


    if(results.multiplier == 0) {
      battleText = textString;
    } else {
      battleText = textString + textStringDmg;
    }

    if(parseInt(results.hpRemaining, 10) <= 0) {
        var fainted = {
          trainerName: otherName,
          pokeName: results.defendingPokemon.name
        }
        return {text: battleText, fainted: fainted };
    } else {
        return { text: battleText };
    }
  }

  return Q( getMoves() )
  .then( getMove )
  .then( _doDamage )
  .then( formOutcomeText )
}

var doDamage = function(moveData, game, trainerName, otherName) {
  var multiplier;
  var damage;
  var attackingPokemon;
  var defendingPokemon;
  var wasCritical = false;
  var damageType;

  var getPokemonType = function() {
    return game.getActivePokemonTypes( otherName )
  },

  getTypeMultiplier = function(types) {
    return pokeapi.getAttackMultiplier(moveData.type.name, types[0], types[1])
    .then( function(_multiplier) { multiplier = _multiplier; } )
  },

  getAttackingPokemon = function() {
    return game.getActivePokemon( trainerName )
    .then( function(_atkPokemon) { attackingPokemon = _atkPokemon; } )
  },

  getDefendingPokemon = function() {
    return game.getActivePokemon( otherName )
    .then( function(_defPokemon) { defendingPokemon = _defPokemon; } )
  },

  checkCritical = function() {
    //TODO: Some moves will have a different critical strike rate. This is the base.
    wasCritical = (Math.floor(Math.random() * 16) === 1);
  },

  // getDamageType = function() {
  //   var type = moveData.damage_class.name;//moves.getDamageType( moveData.name );
  //   if( type === "special" ) {
  //     damageType = 'Special';
  //   } else if( type === 'physical' ) {
  //     damageType = 'Physical';
  //   } else {
  //     damageType = 'Effect';
  //   }
  // },

  calcDamage = function() {
    if( moveData.power == 0 ) {
      return 0;
    }

    var stab = 1;
    attackingPokemon.types.forEach(function( type ) {
      if( type.type.name == moveData.type.name ) {
        stab = 1.5;
      }
    });

    var critical = (wasCritical) ? 1.5 : 1;
    var random = 1 - (Math.floor(Math.random() * 15) / 100);
    var modifier = stab * critical * multiplier * random;

    //TODO: Use special if the attack is special instead of physical
    //TODO: Hardcoded level of 5
    var level = 5;
    var levelModifier = ( ( 2 * level + 10 ) / 250 );

    var attackDefenseRatio = 1.0;
    if( moveData.damage_class.name == 'physical' ) {
      attackDefenseRatio = (attackingPokemon.attack / defendingPokemon.defense);
    } else {
      attackDefenseRatio = (attackingPokemon.sp_attack / defendingPokemon.sp_defense);
    }

    var damage = ( levelModifier * attackDefenseRatio * moveData.power + 2) * modifier;
    // console.log({
    //   a_pokemon: attackingPokemon.name,
    //   a_attack: attackingPokemon.attack,
    //   a_defense: attackingPokemon.defense,
    //   a_sp_attack: attackingPokemon.sp_attack,
    //   a_sp_defense: attackingPokemon.sp_defense,
    //   d_pokemon: defendingPokemon.name,
    //   d_attack: defendingPokemon.attack,
    //   d_defense: defendingPokemon.defense,
    //   d_sp_attack: defendingPokemon.sp_attack,
    //   d_sp_defense: defendingPokemon.sp_defense,
    //   damage: damage, 
    //   levelModifier: levelModifier, 
    //   attackDefenseRatio: attackDefenseRatio,
    //   modifier: modifier,
    //   power: moveData.power
    // });
    return Math.floor(damage);
  };

  _doDamage = function(_damage){
    damage = _damage;
    return game.damageActivePokemon( otherName, damage )
  },

  reportResults = function(hpRemaining) {
    var results = {};
    results.defendingPokemon = defendingPokemon;
    results.hpRemaining = hpRemaining;
    results.damage = damage;
    results.multiplier = multiplier;
    results.wasCritical = wasCritical;
    return results;
  };

  return Q( getPokemonType() )
  .then( getTypeMultiplier )
  .then( getAttackingPokemon )
  .then( getDefendingPokemon )
  .then( checkCritical )
  //.then( getDamageType )
  .then( calcDamage )
  .then( _doDamage )
  .then( reportResults )
}

function getSpriteUrl(dex_no) {
  var stringy = "" + dex_no;
  if (stringy.length == 1) {
    stringy = "00" + stringy;
  } else if (stringy.length == 2) {
    stringy = "0" + stringy;
  }

  return "http://sprites.pokecheck.org/i/"+stringy+".gif";
};


//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/array/shuffle [v1.0]
function shuffle(o){ //v1.0
  for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
};
