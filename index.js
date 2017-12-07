
console.log("Token: " + process.env.TOKEN);
var express = require('express'),
    bodyParser = require('body-parser'),
    // Handle user commands
    commands = require('./commands'),
    app = express(),
    TOKEN = process.env.TOKEN ? JSON.parse(process.env.TOKEN) : [];

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', function(request, response) {
  response.send('Hello There!')
});

function _validateRequest (req, res, next) {
  if (TOKEN.indexOf(req.body.token) !== -1) {
    next();
  } else {
    res.status(401).send("Unauthorized");
  }
}

/*
* This is the main function that recieves post commands from Slack.
* They come in this format:
* {
*   "text": "pkmn battle me",
*   "user": "rvinluan",
*   "channel": "#pkmn_battles"
* }
* There's more stuff but that's all we care about.
* All error handling is bubbled up to this function and handled here.
* It doesn't distinguish between different types of errors, but it probably should.
*/
app.post('/commands', _validateRequest, function(request, response){
  var cmd = request.body.text.toLowerCase();
  commands.runMatchingCommand(cmd, request, response);
})

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})

