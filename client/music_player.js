
var MainPlayer = null;
//use the javascript api to load a flash object
function initPlayer(){
  var params = { allowScriptAccess: "always" };
  var atts = {
    id: "mainplayer",
    wmode:"transparent"
  };
  swfobject.embedSWF("http://www.youtube.com/apiplayer?enablejsapi=1&playerapiid=mainplayer&version=3",
                     "ytapiplayer", "533", "300", "8", null, null, params, atts);
  
}

function onYouTubePlayerReady(playerId){
  console.log("youtube api ready");
  if(playerId==="mainplayer"){
    MainPlayer = document.getElementById(playerId);
    MainPlayer.addEventListener("onStateChange", "onytplayerStateChange");
  }
}

function onytplayerStateChange(state){
  console.log(state);
}
