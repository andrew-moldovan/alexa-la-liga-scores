/**
 * App ID for the skill
 */
var APP_ID = 'amzn1.echo-sdk-ams.app.d5436a14-ed4b-49b2-ad4c-f2fc805a1a6e'; //replace with 'amzn1.echo-sdk-ams.app.[your-unique-value-here]';

var http = require('http'),
  alexaDateUtil = require('./alexaDateUtil');

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

/**
 * LaLigaScores is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 */
var LaLigaScores = function() {
  AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
LaLigaScores.prototype = Object.create(AlexaSkill.prototype);
LaLigaScores.prototype.constructor = LaLigaScores;

// ----------------------- Override AlexaSkill request and intent handlers -----------------------

LaLigaScores.prototype.eventHandlers.onSessionStarted = function(sessionStartedRequest, session) {
  console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId + ", sessionId: " + session.sessionId);
  // any initialization logic goes here
};

LaLigaScores.prototype.eventHandlers.onLaunch = function(launchRequest, session, response) {
  console.log("onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
  handleWelcomeRequest(response);
};

LaLigaScores.prototype.eventHandlers.onSessionEnded = function(sessionEndedRequest, session) {
  console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId + ", sessionId: " + session.sessionId);
  // any cleanup logic goes here
};

/**
 * override intentHandlers to map intent handling functions.
 */
LaLigaScores.prototype.intentHandlers = {
  "OneShotLaLigaIntent": function(intent, session, response) {
    handleOneshotLaLigaRequest(intent, session, response);
  },

  "SupportedTeamsIntent": function(intent, session, response) {
    handleSupportedTeamsRequest(intent, session, response);
  },

  "LeagueTableIntent": function(intent, session, response) {
    handleLeagueTablesRequest(intent, session, response);
  },

  "TopOfTableIntent": function(intent, session, response) {
    handleTopOfTableRequest(intent, session, response);
  },

  "AMAZON.HelpIntent": function(intent, session, response) {
    handleHelpRequest(response);
  },

  "AMAZON.StopIntent": function(intent, session, response) {
    var speechOutput = "Goodbye";
    response.tell(speechOutput);
  },

  "AMAZON.CancelIntent": function(intent, session, response) {
    var speechOutput = "Goodbye";
    response.tell(speechOutput);
  }
};

// -------------------------- LaLigaScores Domain Specific Business Logic --------------------------

// example team to NOAA station mapping. Can be found on: http://tidesandcurrents.noaa.gov/map/
var TEAMS = {
  "FC Barcelona": 81,
  "Club Atlético de Madrid": 78,
  "Real Madrid CF": 86,
  "RC Celta de Vigo": 558,
  "Villarreal CF": 94,
  "RC Deportivo La Coruna": 560,
  "Athletic Club": 77,
  "Sevilla FC": 559,
  "Valencia CF": 95,
  "SD Eibar": 278,
  "Real Betis": 90,
  "RCD Espanyol": 80,
  "Málaga CF": 84,
  "Real Sociedad de Fútbol": 92,
  "Getafe CF": 82,
  "Sporting Gijón": 96,
  "Granada CF": 83,
  "Rayo Vallecano de Madrid": 87,
  "UD Las Palmas": 275,
  "Levante UD": 88
};

function handleWelcomeRequest(response) {
  var whichTeamPrompt = "Which team would you like information for?",
    speechOutput = {
      speech: "<speak>Welcome to La Liga Scores. " + whichTeamPrompt + "</speak>",
      type: AlexaSkill.speechOutputType.SSML
    },
    repromptOutput = {
      speech: "I can lead you through finding the latest fixtures for La Liga and for finding the league table. " + whichCityPrompt,
      type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };

  response.ask(speechOutput, repromptOutput);
}

function handleHelpRequest(response) {
  var repromptText = "What team would you like me to look up?";
  var speechOutput = "I can tell you the La Liga league standings currently. " + repromptText;
  response.ask(speechOutput, repromptText);
}

/**
 * Handles the case where the user asked or for, or is otherwise being with supported teams
 */
function handleSupportedTeamsRequest(intent, session, response) {
  // get team re-prompt
  var repromptText = "Which team would you like information for?";
  var speechOutput = "Currently, I know information about all La Liga teams: " + repromptText;

  response.ask(speechOutput, repromptText);
}

function handleLeagueTablesRequest(intent, session, response) {
  // make the request to get the league table
  makeLeagueTableRequest(function(err, leagueTableOrder) {
    if (err) {
      var speechOutput = "Sorry something went wrong with this request. Maybe our data source is down?";
      response.tellWithCard(speechOutput, "LaLigaScores", speechOutput)
      return;
    }
    leagueTableOrder = parseLeagueTableResults(leagueTableOrder);
    var speechOutput = "The top five teams in the league in the right order are: " + leagueTableOrder;
    response.tellWithCard(speechOutput, "LaLigaScores", speechOutput)
  });
}

function handleTopOfTableRequest(intent, session, response) {
  makeLeagueTableRequest(function(err, leagueTableOrder) {
    if (err) {
      var speechOutput = "Sorry something went wrong with this request. Maybe our data source is down?";
      response.tellWithCard(speechOutput, "LaLigaScores", speechOutput)
      return;
    }
    //grab the top team
    var top = leagueTableOrder.standing[0].teamName;
    var points = leagueTableOrder.standing[0].points;

    var speechOutput = "";
    //grab the second team
    var secondPoints = leagueTableOrder.standing[1].points;
    var secondTeam = leagueTableOrder.standing[1].teamName;
    if (points === secondPoints) {
      speechOutput = top + " and " + secondTeam + " are tied for the top of the table with " + points + " points each.";
    } else {
      speechOutput = top + " is top of the table " + (points - secondPoints) + " clear of " + secondTeam;
    }
    response.tellWithCard(speechOutput, "LaLigaScores", speechOutput);
  });
}

function handleOneshotLaLigaRequest(intent, session, response) {
  // Determine team, using default if none provided
  var team = getTeamFromIntent(intent),
      repromptText,
      speechOutput;

  if (!team || team.error) {
    // invalid team. move to the dialog
    repromptText = "I'm sorry but I didn't understand that team. Can you repeat it please?";
    response.ask(repromptText, repromptText);
    return;
  }

  // if we have an id, let's make a request to get the last fixture of this team
  makeFixtureHTTPRequest(team.id, function(err, data) {
    if (err) {
      var speechOutput = "Sorry something went wrong with this request. Maybe our data source is down?";
      response.tellWithCard(speechOutput, "LaLigaScores", speechOutput)
      return;
    }
    console.log(data.fixtures[0]);
    speechOutput = "The team you asked for is: " + team.team;
    response.tellWithCard(speechOutput, "LaLigaScores", speechOutput);
  });
}

/**
 * Gets the team from the intent, or returns an error
 */
function getTeamFromIntent(intent, assignDefault) {
  var teamSlot = intent.slots.Team;
  // slots can be missing, or slots can be provided but with empty value.
  // must test for both.
  if (!teamSlot || !teamSlot.value) {
    if (!assignDefault) {
      return {
        error: true
      }
    } else {
      // For sample skill, default to FC Barcelona.
      return {
        team: 'FC Barcelona',
        id: TEAMS['FC Barcelona']
      }
    }
  } else {
    // lookup the team. Sample skill uses well known mapping of a few known teams to station id.
    var teamName = teamSlot.value;
    // find the right team, but it isn't totally easy, so maybe just do a contains search
    for (var currentTeam in TEAMS) {
      if (currentTeam.indexOf(teamName) > -1) {
        return {
          team: teamName,
          id: TEAMS[currentTeam]
        }
      }
    }
    return {
      error: true,
      team: teamName
    }
  }
}

function makeLeagueTableRequest(leagueTableCallback) {
  var endpoint = 'http://api.football-data.org/v1/soccerseasons/399/leagueTable';

  http.get(endpoint, function(res) {
    var footballData = '';
    console.log('Status Code: ' + res.statusCode);

    if (res.statusCode != 200) {
      leagueTableCallback(new Error("Non 200 Response"));
    }

    res.on('data', function(data) {
      footballData += data;
    });

    res.on('end', function() {
      var footballDataResponseObject = JSON.parse(footballData);

      if (footballDataResponseObject.error) {
        console.log("Football data error: " + footballDataResponseObject.error);
        leagueTableCallback(new Error(footballDataResponseObject.error));
      } else {
        leagueTableCallback(null, footballDataResponseObject);
      }
    });
  }).on('error', function(e) {
    console.log("Communications error: " + e.message);
    leagueTableCallback(new Error(e.message));
  });
}

function makeFixtureHTTPRequest(id, callback) {
  var endpoint = 'http://api.football-data.org/v1/teams/'+id+'/fixtures';

  http.get(endpoint, function(res) {
    var footballData = '';
    console.log('Status Code: ' + res.statusCode);

    if (res.statusCode != 200) {
      callback(new Error("Non 200 Response"));
    }

    res.on('data', function(data) {
      footballData += data;
    });

    res.on('end', function() {
      var footballDataResponseObject = JSON.parse(footballData);
      if (footballDataResponseObject.error) {
        console.log("Football data error: " + footballDataResponseObject.error);
        callback(new Error(footballDataResponseObject.error));
      } else {
        callback(null, footballDataResponseObject);
      }
    });
  }).on('error', function(e) {
    console.log("Communications error: " + e.message);
    callback(new Error(e.message));
  });
}

function parseLeagueTableResults(results) {
  var output = "";
  for (var i = 0; i < results.standing.length; i++) {
    if (i === 5) {
      break;
    }
    if (i === 4) {
      output += results.standing[i].teamName;
    } else {
      output += results.standing[i].teamName + ", ";
    }
  }
  return output;
}

function getAllTeamsText() {
  var stationList = '';
  for (var station in TEAMS) {
    stationList += station + ", ";
  }

  return stationList;
}

// Create the handler that responds to the Alexa Request.
exports.handler = function(event, context) {
  var laLigaScores = new LaLigaScores();
  laLigaScores.execute(event, context);
};
