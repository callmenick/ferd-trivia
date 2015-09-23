var request = require('request');

module.exports = function(ferd) {

  var questionNumber = 1;
  var maxPoints = {user: '', points: 0};
  var answer;
  var question;
  var category;
  var players = {};
  var intervalId;
  var url = 'http://jservice.io/api/random';
  var m;

  var getEditDistance = function(a, b){
    if(a.length == 0) return b.length; 
    if(b.length == 0) return a.length; 

    var matrix = [];

    // increment along the first column of each row
    var i;
    for(i = 0; i <= b.length; i++){
      matrix[i] = [i];
    }

    // increment each column in the first row
    var j;
    for(j = 0; j <= a.length; j++){
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for(i = 1; i <= b.length; i++){
      for(j = 1; j <= a.length; j++){
        if(b.charAt(i-1) == a.charAt(j-1)){
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                         Math.min(matrix[i][j-1] + 1, // insertion
                         matrix[i-1][j] + 1)); // deletion
        }
      }
    }

    return matrix[b.length][a.length];
  };

  var sender;

  var init = function(theAnswer) {
    return theAnswer.match(new RegExp('ferd trivia', 'i'));
  };
  var answerTest = init;

  ferd.hear(function(message) {
    return answerTest(message.text);
  }, /.*/, function(res) {

    clearInterval(intervalId);

    request(url, function (error, responser, body) {
      var result = JSON.parse(body)[0];
      question = result.question;
      answer = result.answer.replace(/<[^>]*>/g, '').replace(/\\'s/ig, "'s");
      category = result.category.title;

      if(res.incomingMessage.text !== 'ferd trivia') {
        sender = res.getMessageSender();

        if(players[sender.name]) {
          players[sender.name]++;
        } else {
          players[sender.name] = 1;
        }

        if(players[sender.name] > maxPoints.points) {
          maxPoints.points = players[sender.name];
          maxPoints.user = sender.name;
        }
      }

      if(maxPoints.points >= 5) {

        res.send(maxPoints.user + ' has won!');

        questionNumber = 1;
        maxPoints = {user: '', points: 0};
        answerTest = init;
        players = {};
        sender = null;

      } else {
        var text = '> *Question #' + questionNumber + '*: \n\n'
                 + '> *Hint*: ' + category + '\n\n'
                 + '> ' + question;
        if(sender) {
          var text = 'Correct! ' + sender.name + ' has earned ' + players[sender.name] + ' points.\n\n' + text;      
        }

        setTimeout(function(){
          res.send(text);
          
          questionNumber++;
          
          answerTest = function(a) {
            try {
              return getEditDistance(answer, a) <= 3;
            } catch(e) {
              // console.log('error: ',e);
              return false;
            }
          };

          var count = 1;
          intervalId = setInterval(function() {
            if(answer[count] === ' ') {
              count++;
            }
            var hint = answer.slice(0, count);

            if(count === 1) {
              m = res.send('Here is a hint: ' + hint);
            } else {
              res.updateMessage(m, 'Here is a hint: ' + hint);
            }

            count++;

            if(count === answer.length) {
              clearInterval(intervalId);
            }
          }, 10000);
          
        }, 500);

      }
    });

  });

  ferd.listen(/trivia scores/i, function(res) {

    var scores = [];

    for(var player in players) {
      scores.push({
        text: player + ' has ' + players[player] + ' points'
      });
    }

    res.postMessage({
      as_user: true,
      attachments: scores
    });
  });

  ferd.listen(/trivia quit/i, function(res) {

    questionNumber = 1;
    maxPoints = {user: '', points: 0};
    answerTest = init;
    players = {};
    sender = null;


    clearInterval(intervalId);

    res.send('Thanks for playing!');
  });

};
