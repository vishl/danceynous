/*globals Template Session Meteor Backbone*/

var Rooms = new Meteor.Collection("rooms");
var Songs = new Meteor.Collection("songs");
var Users = new Meteor.Collection("users");
var Chats = new Meteor.Collection("chats");

//TODO user needs to keep track of rooms that they have been in
//for now they see all rooms
/*
Meteor.publish('all_rooms', function(){
  return Rooms.find();
});
*/

Meteor.publish('current_room', function(room_id){
  return Rooms.find(room_id);
});

//only return songs for the current room
Meteor.publish('songs', function(room_id){
  //return Songs.find();
  var room = Rooms.findOne(room_id);
  if(room){
    return Songs.find({room_id:room_id});
  }else{
  }
});

//get users that are in your room and are your friends
//exclude idle users
Meteor.publish('room_users', function(room_id){
  //TODO friends
  return Users.find(
        { room_id:room_id,
          status:"present", //{$ne:{status:"idle"}} doesn't work here for some reason
        });
});

Meteor.publish('self_user', function(user_id){
  return Users.find(user_id);
});

//return the chat for the current room
Meteor.publish('chats', function(room_id){
  return Chats.find({room:room_id});
});
