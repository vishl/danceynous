/*globals Template Session Meteor Backbone MainPlayer _ mixpanel*/
////////////////////////////////// Constants ///////////////////////////////////
var CLIENT_KEEP_ALIVE_INTERVAL = 20*1000; //20 sec
var PLAYER_POLL_INTERVAL = 3*1000; //1 sec
var PLAYER_UPDATE_TIME_INTERVAL = 10*1000; //10 sec
var PLAYER_UPDATE_TIME_BUFFER = 0; //0 sec
var POINT_INC_INTERVAL=10*1000; //10 sec
var NEXT_COST = 30;
var VOTE_COST = 1;
var STARTING_TOKENS = 5;
var largeBottom = false;
if(typeof mixpanel ==="undefined"){ mixpanel = null;}

////////////////////////////////// Collections /////////////////////////////////
var Rooms = new Meteor.Collection("rooms");
var Songs = new Meteor.Collection("songs");
var Users = new Meteor.Collection("users");
var Chats = new Meteor.Collection("chats");
var Router;

//subscribe to the list of rooms visible to us
//Meteor.subscribe('rooms', function(){});
//we subscribe to our user model down below when we sign in

Meteor.autosubscribe(function(){
  var room_id = Session.get('current_room_id');
  if(room_id){
    Meteor.subscribe('current_room', room_id);
    //songs in the current room
    Meteor.subscribe('songs', room_id);
    //users in the current room
    Meteor.subscribe('room_users', room_id);
    //and chats
    Meteor.subscribe('chats', room_id);
  }
});

////////////////////////////////// Globals /////////////////////////////////////
Session.set('current_room_id', null);
Session.set('selected_song', null);
Session.set('current_user_id', null);
Session.set('playing_song', null);
Session.set('search_results', null);

function currentUser(){
  return Users.findOne(Session.get('current_user_id'));
}
function currentRoom(){
  return Rooms.findOne(Session.get('current_room_id'));
}
function formatTime(d){
  var h,m,s;
  h = Math.floor(d/3600);
  m = Math.floor((d%3600)/60);
  s = Math.floor(d)%60;
  return (h>0? h+":":"")+(h>0&&m<10?"0":"")+m+":"+(s<10?"0":"")+s;
}

function searching(v){
  largeBottom = v;
  if(v){
    $('#add-container').addClass('searching');
  }else{
    $('#add-container').removeClass('searching');
  }
}

////////////////////////////////// Show ////////////////////////////////////////
Template.show.inRoom = function(){
  return Session.get('current_room_id') && Session.get('current_room_id').length;
};

Template.show.getRoom = function(){
  return Session.get('current_room_id');
};

////////////////////////////////// User Info ///////////////////////////////////
Template.user_info.events = {
  "keyup input":function(e){
    Users.update(Session.get('current_user_id'), {$set:{name:$('#user-name').val()}});
  }
};

Template.user_info.user_id = function(){
  return Session.get('current_user_id');
};
Template.user_info.user_name = function(){
  var u =  Users.findOne(Session.get('current_user_id'));
  if(u){return u.name;}
  return "";
};
Template.user_info.user_tokens = function(){
  var u = Users.findOne(Session.get('current_user_id'));
  if(u){
    return u.tokens;
  }else{
    return 0;
  }
};

/*
Template.show.startPlayer = function(){
  if(Rooms.findOne({_id : Session.get('current_room_id')})){
    console.log("starting player");
    initPlayer();
  }
};
*/

////////////////////////////////// Room List ////////////////////////////////////
Template.room_list.rooms = function(){
  return Rooms.find({});
};

Template.room_item.events = {
  "click a":function(e){
    Router.setRoom($(e.target).data("id"));
  }
};

Template.room_item.selected = function(){
  return Session.equals('current_room_id', this._id) ? "selected" : "";
};

Template.room_item.occupants = function(){
  return Users.find({room_id:this._id});
};
Template.room_item.count = function(){
  return Users.find({room_id:this._id}).count();
};

Template.create.events = {
  'click #create' : function(e){
    var name = $('#new-room-name').val();
    var id = Rooms.insert({name:name, playing:null, playing_time:null});
    Router.setRoom(id);
  }
};


////////////////////////////////// Explore /////////////////////////////////////
//TODO make this not global
//results object is formatted as
// https://developers.google.com/youtube/2.0/developers_guide_jsonc#Understanding_JSONC
function showSearchResults(results){
  if(results){
    var el = $('#search-results');
    var list = $('<ul>');
    el.html(list);
    for(var i in results.data.items){
      var r = results.data.items[i];
      var id = r.id;
      var name = r.title;
      //list.append('<li><a data-ytid="'+id+'">'+name+'</a></li>');
      list.append(Template.result_item({id:r.id, name:r.title, thumb:r.thumbnail.sqDefault}));
    }
  }else{
  }
}

function performYtSearch(q, callback){
  $.getJSON('https://gdata.youtube.com/feeds/api/videos?callback=?',
            {
              q:q,
              alt:'jsonc',
              v:'2',
              format:'5',
            },
            callback
           );
}

function performYtPopularSearch(callback){
  $.getJSON('https://gdata.youtube.com/feeds/api/standardfeeds/most_popular/-/Music?callback=?',
            {
              alt:'jsonc',
              v:'2',
              format:'5',
            },
            callback
           );
}

Template.add_song.events = {
  "focus input":function(e){
  },
  "blur input":function(e){
    if(!$(e.currentTarget).val()){
      searching(false);
      setHeight();
    }
  },
  "keyup input":_.debounce(function(e){
    e.preventDefault();
    var val = $(e.currentTarget).val();
    if(val.length){
      if(val==="#popular"){
        performYtPopularSearch(function(r){Session.set("search_results", r.data.items);});
      }else{
        performYtSearch(val, function(r){Session.set("search_results", r.data.items);});
      }
      searching(true);
      setHeight();
    }
  }, 250),
  "click .close":function(e){
    Session.set("search_results", null);
    $('#add-song').val("");
    searching(false);
    setHeight();
  },
  "click #popular":function(e){
    performYtPopularSearch(function(r){Session.set("search_results", r.data.items);});
    $('#add-song').val("#popular");
    searching(true);
    setHeight();
  },
};

Template.result_item.events = {
  "click .add":function(e){
    e.preventDefault();
    Songs.insert({name:this.title, ytid:this.id, room_id:Session.get('current_room_id'), user_id:Session.get('current_user_id'), score:0});
    if(mixpanel && mixpanel.track){mixpanel.track("Add Song");}
  },
  "click .preview.preview-open":function(e){
    //close any other previews
    $('iframe.preview-iframe').remove();
    $('.preview.preview-close').addClass('preview-open').removeClass('preview-close');
    //open this preview
    var $p = $(e.currentTarget);
    $p.removeClass("preview-open");
    $p.addClass("preview-close");
    var $t = $p.parents('.result-container');
    var $pf = $(Template.preview_frame({ytid:this.id}));
    $t.append($pf);
    MainPlayer.mute();
    //$pf.on('click', '.close', function(){$pf.remove();MainPlayer.unMute();});
  },
  "click .preview.preview-close":function(e){
    var $p = $(e.currentTarget);
    var $t = $p.parents('.result-container');
    $p.addClass("preview-open");
    $p.removeClass("preview-close");
    $t.find('iframe').remove();
    MainPlayer.unMute();
  },
};

Template.result_item.duration_pp = function(){
  return formatTime(this.duration);
};


Template.explore.x = function(){
  return [];
};
Template.explore.search_results = function(){
  var r =Session.get("search_results"); 
  if(r instanceof Array){
    return r;
  }else{
    return [];
  }
};


////////////////////////////////// Room Info ////////////////////////////////////
Template.room.getName = function(){
  if(Rooms.findOne({_id : Session.get('current_room_id')})){
    return Rooms.findOne({_id : Session.get('current_room_id')}).name;
  }else{
    return "";
  }
};

var delayChat = _.debounce(function(attrs){Chats.insert(attrs);}, 1000, true);
Template.playlist.events = {
  "click .upvote":function(e){
    var s = Songs.findOne(Session.get('selected_song'));
    var u = Users.findOne(Session.get('current_user_id'));
    if(s && (currentUser().tokens>0)){
      Songs.update(s._id, {$inc:{score:1}});
      Users.update(Session.get('current_user_id'), {$inc:{tokens:-1}});
      //Chats.insert({name:u.name, message:"upvoted "+s.name, room:Session.get('current_room_id')}); 
      delayChat.call(this, {name:u.name, message:"upvoted "+s.name, room:Session.get('current_room_id')}); 
      if(mixpanel && mixpanel.track){mixpanel.track("UpVote");}
    }
  },
  "click .downvote":function(e){
    var s = Songs.findOne(Session.get('selected_song'));
    var u = Users.findOne(Session.get('current_user_id'));
    if(s && (currentUser().tokens>0)){
      Songs.update(s._id, {$inc:{score:-1}});
      Users.update(Session.get('current_user_id'), {$inc:{tokens:-1}});
      delayChat.call(this, {name:u.name, message:"downvoted "+s.name, room:Session.get('current_room_id')});
      if(mixpanel && mixpanel.track){mixpanel.track("DownVote");}
    }
  },

};

Template.playlist.tokens = function(){
  var u = currentUser();
  if(u){
    return u.tokens;
  }
};


Template.playlist.has_songs = function(){
  if(Songs.find({room_id:Session.get('current_room_id')}).count()===0){
    return false;
  }
  return true;
};

Template.playlist.songs = function(){
  var room_id = Session.get('current_room_id');
  var songs;
  if(!room_id){
    return {};
  }
  return Songs.find({room_id:room_id}, {sort:{score:-1}});
};

Template.playlist_item.events = {
  "click .play":function(e){
    //Rooms.update(Session.get('current_room_id'), {$set:{playing:this._id, playing_time:0}});
    playSong(this._id);
  },
  "click .remove":function(e){
    Songs.remove(this._id);
  },
  "click":function(){
    Session.set('selected_song', this._id);
  }
};


Template.playlist_item.selected = function(){
  return Session.equals('selected_song', this._id) ? "selected" : "";
};

Template.playlist_item.owner = function(){
  return Session.equals('current_user_id', this.user_id);
};

function playSong(song_id){
  //console.log("updating room");
  Rooms.update(Session.get('current_room_id'), {$set:{playing:song_id, playing_time:0}});
}
function playNothing(song_id){
  Rooms.update(Session.get('current_room_id'), {$set:{playing:"", playing_time:0}});
}

function startCurrentSong() {
  //console.log("start current song");
  var room = Rooms.findOne(Session.get('current_room_id'));
  var song= null;
  if(room && room.playing){
    song = Songs.findOne(room.playing);
    if(song){
      if(MainPlayer){
        if(!Session.equals("playing_song", song._id)){
          //console.log("start current song in player");
          Session.set("playing_song", song._id);
          MainPlayer.loadVideoById(song.ytid, room.playing_time);
          return true;
        }else{
          //console.log("not playing song (already playing)");
          return true;
        }
      }else{
        //console.log("not playing song (no player)");
        return true;//don't want to cycle if no player
      }
    }else{
      //console.log("not playing song (no song)");
    }
  }else{
    //console.log("not playing song (no room/playing)");
  }
  return false;
}

function playFirstSong(){
  //console.log("play first song");
  var room = Rooms.findOne(Session.get('current_room_id'));
  if(room){
    var song = Songs.findOne({room_id:room._id}, {sort:{score:-1}});
    if(song){
      //set it as playing
      playSong(song._id);
    }else{
      playNothing();
    }
  }
}

function cyclePlaylist(){
  //console.log("cycle playlist");
  //Delete current song
  var room = Rooms.findOne(Session.get('current_room_id'));
  if(room){
    var song = Songs.findOne(room.playing);
    if(song){
      Songs.remove(song._id);   //TODO do we want to keep a record of song history somewhere?
    }
    playFirstSong();
  }
}

function updateTime(){
  var room = Rooms.findOne(Session.get('current_room_id'));
  var song = null;
  var time = null;
  if(room && room.playing){
    song = Songs.findOne(room.playing);
    if(song){
      if(MainPlayer){
        time = MainPlayer.getCurrentTime();
        if(time>(room.playing_time+PLAYER_UPDATE_TIME_BUFFER)){
          //console.log("updating time to "+time);
          Rooms.update( //only update the time if the song is the same and we are incrementing the time
            {
              _id:Session.get('current_room_id'), 
              //playing_time:{$lt:time},    //TODO, i don't think this works right now
              playing:song._id
            },
            {$set:{playing_time:time}}
          );
        }
      }
    }
  }
}


////////////////////////////////// Player //////////////////////////////////////
Template.player.events = {
  "click #mute":function(e){
    e.preventDefault();
    if(MainPlayer.isMuted()){
      MainPlayer.unMute();
    }else{
      MainPlayer.mute();
    }
  },
};

Template.player_info.events ={ 
  "click #next":function(e){
    var u = currentUser();
    if(u.tokens>=NEXT_COST){
      Users.update(Session.get('current_user_id'), {$inc:{tokens:-1*NEXT_COST}});
      Chats.insert({name:u.name, message:"skipped to the next song!", room:Session.get('current_room_id')}); //TODO how to sort by time?
      cyclePlaylist();
      if(mixpanel && mixpanel.track){mixpanel.track("Next");}
    }else{
      alert("Not enough points.  They accumulate over time, so be patient");
    }
  }
};

Template.player_info.playing = function(){
  var room = Rooms.findOne(Session.get('current_room_id'));
  var song= null;
  if(room){
    song = Songs.findOne(room.playing);
    if(song){
      return song.name;
    }
  }
  return null;
};

Template.player_info.time = function(){
  var room = Rooms.findOne(Session.get('current_room_id'));
  if(room){
    return room.playing_time;
  }
};

Template.player_info.play = function(){
  //console.log("render play");
  startCurrentSong();
};
Template.player_info.stop = function(){
  //console.log("render stop");
  if(MainPlayer){
    MainPlayer.loadVideoById("");   //don't use stop video, that yield a stupid play button
  }
};

Template.player_info.next_cost = function(){
  return NEXT_COST;
};

//have to poll player state because event could happen while meteor is in the middle of something
function playerInit(){
  Meteor.setInterval(function(){
    if(MainPlayer){
      var state = MainPlayer.getPlayerState();
      //console.log("player polled state " + state);
      if(state === 0){   //ended
        cyclePlaylist();
      }else if(state=== -1 || state===5 || state===2){//not started
        if(!startCurrentSong()){
          //if no current song, attempt to get the next song from the playlist
          cyclePlaylist();
        }
      }else if(state=== 1 || state===3){//playing or buffering
        //nothing here, do this at a different interval bc it hits the server
      }
    }
  }, PLAYER_POLL_INTERVAL);

  Meteor.setInterval(function(){
    if(MainPlayer){
      var state = MainPlayer.getPlayerState();
      if(state===1){
        updateTime();
      }
    }
  }, PLAYER_UPDATE_TIME_INTERVAL);

  Meteor.setInterval(function(){
    if(MainPlayer){
      var state = MainPlayer.getPlayerState();
      if(state===1){
        $('#elapsed').html(formatTime(MainPlayer.getCurrentTime()));
        $('#duration').html(formatTime(MainPlayer.getDuration()));
      }
    }
  }, 1000); //update the status time on the local player

}

////////////////////////////////// Chat //////////////////////////////////
Template.chat_room.events = {
  "keyup input":function(e){
    var v, u, r;
    e.preventDefault();
    v = $(e.currentTarget).val();
    u = Users.findOne(Session.get('current_user_id'));
    r = Rooms.findOne(Session.get('current_room_id'));
    if(e.which===13 && v.length && u && r){
      Chats.insert({name:u.name, message:v, room:r._id}); //TODO how to sort by time?
      $(e.currentTarget).val("");
      Meteor.flush();   //render this message, then scroll
      scrollChat();
    }
    if(e.which===27){
      $(e.currentTarget).val("");
    }
  }
};

Template.chat_room.chat_messages_count = function(){
  return Chats.find({room:Session.get('current_room_id')}).count();
};
Template.chat_room.chat_messages = function(){
  return Chats.find({room:Session.get('current_room_id')});
};

Template.chat_room.scroll= function(){
  var $t = $('#chat-inner');
  //only scroll if we're at the bottom
  if($t.prop("scrollTop")>$t.prop("scrollHeight")-$t.height()-50){
    Meteor.setTimeout(scrollChat, 150); //hack to make sure we've rendered
  }
};

function scrollChat(){
  //console.log("scroll");
  var $t = $('#chat-inner');
  $t.prop("scrollTop", $t.prop("scrollHeight")-$t.height());
}


////////////////////////////////// Navigation //////////////////////////////////
var MusicRouter = Backbone.Router.extend({
  routes:{
    "":"home",
    ":room_id":"room",
  },
  room:function(room_id){
    Session.set("current_room_id", room_id);
    Session.set("selected_song", null);
    Users.update(Session.get('current_user_id'), {$set:{room_id:room_id, tokens:STARTING_TOKENS}});
    Meteor.flush(); //flush so the player div is there already
    initPlayer();   //external ref to player api
    setHeight();
  },
  setRoom:function(room_id){
    this.navigate(room_id, true);
  },
  home:function(){
    //create a new room and put them in it
    var id = Rooms.insert({name:"Dance Party", playing:null, playing_time:null});
    Router.setRoom(id);
    Meteor.flush();
    $('#info-modal').modal('show');
    //tracking
    if(mixpanel && mixpanel.track){mixpanel.track("Create");}
  }
});

Router = new MusicRouter();

Meteor.startup(function(){
  //get/create user
  //TODO use facebook to get user
  var id, u;
  id=$.cookie('user_id') ;
  if(id){
    Session.set('current_user_id',id);
    Meteor.subscribe('self_user', id);
    //Users.update(id, {$set:{tokens:5}});
    u = Users.find(id).fetch();
    if(u && !u.name){
      //Users.update(id, {$set:{name:'Bob'+Math.floor(Math.random()*10)}});
    }
  }else{
    //need to create a new user
    id = Users.insert({status:"present", last_keepalive:0, room_id:null, tokens:STARTING_TOKENS, name:'Bob'+Math.floor(Math.random()*10)});
    Meteor.subscribe('self_user', id);
    $.cookie('user_id', id);
    Session.set('current_user_id',id);
  }

  //call keepalive immediately so it is set with the server time
  Meteor.call('keepalive', id);
  // send keepalives so the server can tell when we go away.
  //
  // XXX this is not a great idiom. meteor server does not yet have a
  // way to expose connection status to user code. Once it does, this
  // code can go away.
  Meteor.setInterval(function() {
    if (Meteor.status().connected)
      Meteor.call('keepalive', Session.get('current_user_id'));
  }, CLIENT_KEEP_ALIVE_INTERVAL);

  //auto increment the number of points we have
  Meteor.setInterval(function(){
    if(currentUser() && currentUser().tokens<100){
      Users.update(Session.get('current_user_id'), {$inc:{tokens:1}});
    }
  },POINT_INC_INTERVAL);

  playerInit(); //poll the yt player

  Backbone.history.start({pushState:true});
  Meteor.flush();   //render everything
  $('#share-link').val(document.location.href);
  setHeight();
});

////////////////////////////////// Auto Height /////////////////////////////////
//hack to get this thing full screen
function setHeight(){
  var bottomHeight, topHeight;
  var windowHeight = $(window).height();
  if(largeBottom){
    topHeight=330;
    bottomHeight = Math.max(300, windowHeight-topHeight);
  }else{
    bottomHeight = 0;
    topHeight = Math.max(300, windowHeight-bottomHeight-50);
  }
  $('#top-row').css("height", topHeight+'px');
  $('#bottom-row').css("height", bottomHeight+'px');

 //$('#bottom-row').css("min-height", $(window).height()-$('#top-row').height()-65 + "px");
}
$(function(){
  setHeight.call(this);
  $(window).bind("resize", setHeight);
});

