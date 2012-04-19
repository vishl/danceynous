/*globals Template Session Meteor Backbone Users*/

var SERVER_KEEP_ALIVE_INTERVAL = 30*1000;   //30sec
var IDLE_INTERVAL = 70*1000;    //70 sec

//Keepalive code to keep track of who is logged in
Meteor.methods({
  keepalive: function (user_id) {
    Users.update({_id: user_id},
                 {$set:{
                     last_keepalive: (new Date()).getTime(),
                     status: "present"
                   }
                 }
                );
  }
});  

Meteor.setInterval(function () {
  var now = (new Date()).getTime();
  var idle_threshold = now - IDLE_INTERVAL; 

  /*This doesn't seem to work
  Players.update({last_keepalive: {$lt: idle_threshold}},
                 {$set: {idle: true}});
                 */
  //doing a foreach here causes node to crash =/
  var idles = Users.find({status:"present", last_keepalive: {$lt: idle_threshold}}).fetch();

  //console.log("setting "+idles.length+" users to idle");
  for(var i in idles){
      var p = idles[i];
      Users.update(p._id, {$set:{status:"idle"}});
  }
}, SERVER_KEEP_ALIVE_INTERVAL);


//TODO delete stale rooms
