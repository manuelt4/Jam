'use strict';

angular.module('controller', ['songServices', 'ngResource']).controller('MainController', [
	'$scope',
	'songs',
	'socket',
	'socket-controller',
	'$resource',
	function($scope, songs, socket, socket_controller, $resource) {

		$scope.main = {};

		$scope.main.nowPlaying = {
			songName: "",
			artist: ""
		};

		$scope.main.lastPlayed = {
			songName: "",
			artist: "No Previous Song"
		};

		$scope.main.searchResults = false;
		$scope.main.searchList = [];
		$scope.main.imgURL = "img/noImg.png";

		// $scope.main.buttonimg = 'img/pause.png';
		// if(!$scope.main.nowPlaying.isPlaying) {
		// 	$scope.main.buttonimg = 'img/pause.png';
		// } else {  // Pause
		// 	$scope.main.buttonimg = 'img/play.png';
		// }

		/* EVENT HANDLERS */

		$scope.main.toggleClick = function($event, id) {

			// Figured out the liking glitch! Different parts of the heart are considered
			// the event target depending on exactly where you click.
			if ($event.target.classList.contains('liked')
			 || $event.target.parentElement.classList.contains('liked')
			 || $event.target.parentElement.parentElement.classList.contains('liked')
			) {
				// we will 'unlike' it
				socket.emit('send:downvote', {'id': id} );
				songs.iVoted(id, false);
			} else {
				// we will 'like' it
				socket.emit('send:upvote', {'id': id} );
				songs.iVoted(id, true);
			}

			console.log("heart clicked for " + id);
		};

		$scope.main.addClick = function($event, id, index) {

			// Figured out the liking glitch! Different parts of the heart are considered
			// the event target depending on exactly where you click.

			console.log(index);

			if ($event.target.classList.contains('add')
			 || $event.target.parentElement.classList.contains('add')
			 || $event.target.parentElement.parentElement.classList.contains('add')
			) {
				// we will 'unlike' it
				$scope.addSong($scope.main.searchList[index]);
				$event.target.classList.remove('add')
			 	$event.target.parentElement.classList.remove('add')
			 	$event.target.parentElement.parentElement.classList.remove('add')
			 	$event.target.src = "img/check.png"
			} else {
				// we will 'like' it
				console.log("Already added");
			}

			// console.log("heart clicked for " + id);
		};

		$scope.main.playlist = songs.songs;

		// SEARCHING AND ADDING SONGS //

		function search() {
			socket.emit("get:search", {query: $scope.searchString});
			//$scope.searchString = '';
		}

		var typingTimer;                //timer identifier
		var doneTypingInterval = 250;  //time in ms (5 seconds)
		// On press enter in the search bar, call search()
		$("#search_bar").on('keyup', function (e) {
			// if (e.keyCode == 13) {
			// 	$scope.$apply(search);
			// }
			clearTimeout(typingTimer);
			if (this.value) {
				typingTimer = setTimeout(doneTyping, doneTypingInterval);

				function doneTyping() {
					$scope.$apply(search);
					$scope.main.searchResults = true;
				}

			} else {
				console.log("EMPTY");
				$scope.$apply(function() {
					$scope.main.searchResults = false;
				});
			}
		});

		document.addEventListener('click', function(e) {
			var el = $(e.target);
			if (el.parents('div#targetArea').length) {

			} else {
				$("#search_bar").value = '';
				$scope.$apply(function() {
					$scope.main.searchResults = false;
				});
			}
		});

		function filterOutSongsAlreadyAdded(results) {
			console.log(results)
			var newResults = [];
			results.forEach(function(result) {
				if (!songs.contains(result.id)) {
					newResults.push(result);
				}
			});
			return newResults;
		}

		$scope.addSong = function(song) {
			console.log('adding song: ' + song.id);
			socket.emit('send:add-song', song);
			// $("#search_bar").value = '';
			// $scope.main.searchResults = false;
		};

		// PLAYBACK SECTION //

		function _playNow(link) {
			// actually start playing the song
			var aud = document.getElementById("audioElement");
			// aud.src =  "music/" + link;
			aud.src = link;
			var timestamp = undefined;  // TODO: Get timestamp of now
			aud.play();
		}

		function _setAsNowPlaying(newNowPlaying, newLastPlayed) {
			$scope.main.lastPlayed = newLastPlayed;
			// must set last played before now playing to avoid clobbering
			$scope.main.nowPlaying = newNowPlaying;

			// TODO: seek bar
		}

		function _createNowPlaying(song) {
			return {
				id: song.id,
				songName: song.songName,
				artist: song.artist,
				albumId: song.albumId,

				isPlaying: false,
				timeResumed: undefined,
				resumedSeekPos: 0
			};
		}

		function beginNextSong() {
			var song = songs.popNext();

			if (song == null) {
				console.log("No more songs in queue.");
				socket.emit('send:now-playing', {
					np: _createNowPlaying({
						id: '',
						songName: "No Current Song",
						artist: "",
						albumId: ''
					}),
					lp: $scope.main.nowPlaying
				});

			} else {
				console.log("requesting to server to play " + song.songName);
				socket.emit('send:now-playing', {
					np: _createNowPlaying(song),
					lp: $scope.main.nowPlaying
				});
			}
		}

		function beginPlayback() {
			var aud = document.getElementById("audioElement");
			aud.onended = function() { $scope.$apply(beginNextSong) };
			beginNextSong();
		};

		function play() {
			var aud = document.getElementById("audioElement");
			aud.play();

			$scope.main.nowPlaying.isPlaying = true;
			// $scope.main.buttonimg = 'img/pause.png';

			console.log('audio playing');
			socket.emit('send:play');
		};

		function pause() {
			var aud = document.getElementById("audioElement");
			aud.pause();

			$scope.main.nowPlaying.isPlaying = false;
			// $scope.main.buttonimg = 'img/play.png';

			console.log('audio paused');
			socket.emit('send:pause');
		};

		$scope.main.togglePlay = function() {
			if($scope.main.nowPlaying.songName === "") {
				beginPlayback();
			} else {
				if($scope.main.nowPlaying.isPlaying) {
					pause();
				} else {
					play();
				}
			}
		};

		$scope.main.Skip = function() {
			beginNextSong();
		};

		// Receive playback events from server

		socket.on('push:now-playing', function(data) {
			_setAsNowPlaying(data.np, data.lp);
			if(data.np.songName === "" || data.np.songName === "No Current Song") {
				$scope.main.nowPlaying.isPlaying = false;
				return;
			}

			console.log("Now Playing: " + data.np.songName + " by " + data.np.artist);
			if(document.getElementById('skipButton')) {  // We are on host
				// Actually start playing song
				$scope.main.nowPlaying.timeResumed = _playNow(data.npUrl);
				$scope.main.nowPlaying.isPlaying = true;

			} else {
				songs.removeById(data.np.id);
			}
		});

		socket.on('push:play', function() {
			console.log('received push:play');
			$scope.main.nowPlaying.isPlaying = true;
		});

		socket.on('push:pause', function() {
			console.log('received push:pause');
			$scope.main.nowPlaying.isPlaying = false;
		});

		// Receive Google Music API search results back from server
		socket.on('send:search', function(data) {
			var newResults = filterOutSongsAlreadyAdded(data.results);
			$scope.main.searchList = newResults;
		});

		// RESET DB
		$scope.main.reset = function() {
			console.log("sending reset");
			socket.emit('send:reset');
		};
}
]);
