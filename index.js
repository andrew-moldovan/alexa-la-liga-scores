/**
 * App ID for the skill
 */
var APP_ID = 'amzn1.echo-sdk-ams.app.45bdd5aa-4675-4fd7-95ec-1560a666c1e1';//replace with 'amzn1.echo-sdk-ams.app.[your-unique-value-here]';

var http = require('http'),
    alexaDateUtil = require('./alexaDateUtil');

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

/**
 * TidePooler is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 */
var TidePooler = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
TidePooler.prototype = Object.create(AlexaSkill.prototype);
TidePooler.prototype.constructor = TidePooler;

// ----------------------- Override AlexaSkill request and intent handlers -----------------------

TidePooler.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};

TidePooler.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    handleWelcomeRequest(response);
};

TidePooler.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};

/**
 * override intentHandlers to map intent handling functions.
 */
TidePooler.prototype.intentHandlers = {
    "OneShotLaLigaIntent": function (intent, session, response) {
      handleOneshotLaLigaRequest(intent, session, response);
    },

    "SupportedTeamsIntent": function (intent, session, response) {
      handleSupportedTeamsRequest(intent, session, response);
    },

    "LeagueTableIntent": function (intent, session, response) {
      handleLeagueTablesRequest(intent, session, response);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
      handleHelpRequest(response);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
      var speechOutput = "Goodbye";
      response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
      var speechOutput = "Goodbye";
      response.tell(speechOutput);
    }
};

// -------------------------- TidePooler Domain Specific Business Logic --------------------------

// example team to NOAA station mapping. Can be found on: http://tidesandcurrents.noaa.gov/map/
var TEAMS = {
    'FC Barcelona': 9447130,
    'Club Atletico de Madrid': 9414290,
    'Real Madrid CF': 9413450,
    'RC Celta de Vigo': 9410660,
    'Villarreal CF': 9410170
};

function handleWelcomeRequest(response) {
    var whichTeamPrompt = "Which team would you like information for?",
        speechOutput = {
            speech: "<speak>Welcome to La Liga Scores. "
                + whichTeamPrompt
                + "</speak>",
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
 * Handles the case where the user asked or for, or is otherwise being with supported cities
 */
function handleSupportedTeamsRequest(intent, session, response) {
  // get team re-prompt
  var repromptText = "Which team would you like information for?";
  var speechOutput = "Currently, I know information about these teams: " + getAllTeamsText()
      + repromptText;

  response.ask(speechOutput, repromptText);
}

function handleLeagueTablesRequest(intent, session, response) {
  // make the request to get the league table
  makeLeagueTableRequest(function (err, leagueTableData) {
    console.log(leagueTableData);
  });
}

/**
 * This handles the one-shot interaction, where the user utters a phrase like:
 * 'Alexa, open Tide Pooler and get tide information for Seattle on Saturday'.
 * If there is an error in a slot, this will guide the user to the dialog approach.
 */
function handleOneshotLaLigaRequest(intent, session, response) {

    // // Determine team, using default if none provided
    // var team = getCityStationFromIntent(intent, true),
    //     repromptText,
    //     speechOutput;
    // if (team.error) {
    //     // invalid team. move to the dialog
    //     repromptText = "Currently, I know information for these teams: " + getAllTeamsText()
    //         + "Which team would you like fixture information for?";
    //     // if we received a value for the incorrect city, repeat it to the user, otherwise we received an empty slot
    //     speechOutput = team.city ? "I'm sorry, I don't have any data for " + team.city + ". " + repromptText : repromptText;
    //
    //     response.ask(speechOutput, repromptText);
    //     return;
    // }
    //
    // // all slots filled, either from the user or by default values. Move to final request
    // getFinalTideResponse(team, date, response);
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
    if (TEAMS[teamName.toLowerCase()]) {
        return {
            team: teamName,
            id: TEAMS[teamName.toLowerCase()]
        }
    } else {
        return {
            error: true,
            team: teamName
        }
    }
  }
}

function makeLeagueTableRequest(leagueTableCallback) {
    var endpoint = 'http://api.football-data.org/v1/soccerseasons/399/leagueTable';

    http.get(endpoint, function (res) {
        var footballData = '';
        console.log('Status Code: ' + res.statusCode);

        if (res.statusCode != 200) {
            leagueTableCallback(new Error("Non 200 Response"));
        }

        res.on('data', function (data) {
            footballData += data;
        });

        res.on('end', function () {
            var footballDataResponseObject = JSON.parse(footballData);

            if (footballDataResponseObject.error) {
                console.log("Football data error: " + footballDataResponseObject.error);
                leagueTableCallback(new Error(footballDataResponseObject.error));
            } else {
                leagueTableCallback(null, footballDataResponseObject);
            }
        });
    }).on('error', function (e) {
        console.log("Communications error: " + e.message);
        leagueTableCallback(new Error(e.message));
    });
}

function getAllTeamsText() {
    var stationList = '';
    for (var station in TEAMS) {
        stationList += station + ", ";
    }

    return stationList;
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    var tidePooler = new TidePooler();
    tidePooler.execute(event, context);
};
