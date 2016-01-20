//Generate messages for different situations
var battleText = require('./battle-text.js')
    stateMachine = require('./state-machine.js');


module.exports = exports = (function () {

    function Command (type, helpText, regex, action) {
        this.type = type;
        this.helpText = helpText;
        this.regex = regex;
        this.action = action;
    }

    /*
    * Helper function to build the JSON to send back to Slack.
    * Make sure to make a custom emoji in your Slack integration named :pkmntrainer:
    * with the included pkmntrainer jpeg, otherwise the profile picture won't work.
    */
    function buildResponse(text) {
      var json = {
        "text": text,
        "username": "Pokemon Trainer",
        "icon_emoji": ":pkmntrainer:"
      }
      return JSON.stringify(json);
    }

    var _commands = [];

    var cmds = {
        Command: Command,
        addCommand: function (cmd) {
            _commands.push(cmd);
            return this;
        },
        runMatchingCommand: function (actionText, req, res) {
            var i, c, m;
            for (i = 0; i < _commands.length; i++) {
                c = _commands[i];
                m = c.regex.exec(actionText);
                if (m) {
                    // Found a match
                    c.action(m, req, res);
                    break; // Stop after the first match is found.
                }
            }
        }
    };

    // Set up the available commands
    cmds
      .addCommand(new Command('CHOOSE', '`pkmn i choose <pokemon_name>` - chooses a pokemon by name',
        /pkmn i choose ([\w-]+)/, function (match, req, res) {
        battleText.choosePokemon(req.body.user_name, req.body.user_name, [match[1]])
        .then(
          function(chosenObject){
            res.send(buildResponse(chosenObject.text + '\n' + chosenObject.spriteUrl));
          },
          function(err){
            console.log(err);
            res.send(buildResponse("I don't think that's a real Pokemon. "+err));
          }
        ).done();
      }))
      .addCommand(new Command('ATTACK', '`pkmn use <ability>` - uses the specified ability',
        /pkmn use ([\w-]+)/, function (match, req, res) {
            var moveName = match[1];

            battleText.doTurn(moveName.toLowerCase(), req.body)
            .then(
              function(textString){
                res.end(buildResponse(textString));
              },
              function(err){
                console.log(err);
                res.send(buildResponse("You can't use that move. "+err))
              }
            )
      }))
      .addCommand(new Command('START', '`pkmn battle me` - starts a new battle',
       /pkmn (battle|fite) (me)/, function (match, req, res) {
        battleText.startBattle(req.body)
        .then(
          function(startObj){
            res.send(buildResponse(startObj.text + "\n" + startObj.spriteUrl))
          },
          function(err) {
            console.log(err);
            res.send(buildResponse("Something went wrong. "+err));
          }
        )
      }))
      .addCommand(new Command('END', '`pkmn end battle` - stops the current battle',
        /pkmn end battle/, function (match, req, res) {
        battleText.endBattle(req.body)
        .then(
          function(){
            res.send(buildResponse("Battle Over."))
          },
          function(err){
            console.log(err);
            res.send(buildResponse("Couldn't end the battle. "+err))
          }
        )
      }))
      .addCommand(new Command('MOVE-STAT', '`pkmn stat <move>` - shows the stats for a move your pokemon knows',
        /pkmn stat ([\w-]+)/, function (match, req, res) {
           stateMachine.getActivePokemonAllowedMoves(req.body.user_name, req.body.user_name)
           .then(function (moves) {
              if (moves.indexOf(match[1]) === -1) {
                res.send(buildResponse('Your pokemon doesn\'t know that move.'));
              } else {
                stateMachine.getSingleMove(match[1]).then(function (m) {
                  res.send(buildResponse(JSON.stringify(m)));
                });
                
              }
           });
        }
      ))
      .addCommand(new Command('HELP', '`pkmn help` - shows the available commands',
        /pkmn (help)/, function (match, req, res) {
            var text = 'Available Commands:\n' +
            _commands.map(function (c) {
                return c.helpText ? '* ' + c.helpText : null;
            }).filter(function (t) {
                return t !== null;
            }).join('\n');

            res.send(buildResponse(text));
        }
      ))
      .addCommand(new Command('DEFAULT', null,
        /pkmn (.*)/, function (match, req, res) {
        battleText.unrecognizedCommand(match[1])
        .then(function(text){
          res.send(buildResponse(text));
        });
      }))
      .addCommand(new Command('DEFAULT', null,
        /(.*)/, function (match, req, res) {
          res.send(buildResponse(''));
      }));

    return cmds;

})();
