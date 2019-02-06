var media = [];
var playlist = [];
var vidId = 0;
var vidUrl = "https://kfc.urbanway.net";
var corsUrl = "https://cors-anywhere.herokuapp.com/";
var playlistUrl = "https://my-json-server.typicode.com/diamanthaxhimusa/kfcadmin/db";
var vid1 = corsUrl + "https://storage.googleapis.com/shaka-demo-assets/sintel-mp4-only/dash.mpd";
var vid2 = corsUrl + "https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd";
var downloadInProgress = false;

function initApp() {
  dw1 = document.getElementById('download-button');
  dw2 = document.getElementById('dwnbtn');

  // Install built-in polyfills to patch browser incompatibilities.
  shaka.polyfill.installAll();

  // Check to see if the browser supports the basic APIs Shaka needs.
  if (shaka.Player.isBrowserSupported()) {
    // Everything looks good!
    initPlayer();
  } else {
    // This browser does not have the minimum set of APIs we need.
    console.log('Browser not supported!', "error");
  }

  // Update the online status and add listeners so that we can visualize
  // our network state to the user.
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

function initPlayer() {
  // Create a Player instance.
  var video = document.getElementById('video');
  var player = new shaka.Player(video);

  // Attach player and storage to the window to make it easy to access
  // in the JS console and so we can access it in other methods.
  window.player = player;

  // Listen for error events.
  player.addEventListener('error', onErrorEvent);
  video.addEventListener('onended', onEndEvent);
  video.onended = onEndEvent;
  initStorage(player);

  // Update the content list to show what items we initially have
  // stored offline.

  // refreshContentList();

  // listContent()
  //   .then(function (content) {
  //     if (content.length) {
  //       media = content;
  //       player.load(content[vidId].offlineUri)
  //     }
  //   });
}


function initPlaylist() {
  console.log("gettting data");
  if (navigator.onLine) {
    $.ajax({
      url: corsUrl+playlistUrl,
      type: 'GET',
      dataType: 'json',
      success: function(data) {
        console.warn(data);
        var playlistData = data.data;
        var playlistUpdatedAt = playlistData.playlist.updated_at;
        var lastupdated = window.localStorage.getItem('kfc_updated');
        if (lastupdated != playlistUpdatedAt) {
          console.log("New videos! Downloading now...", "success");
          window.localStorage.setItem('kfc_updated', playlistUpdatedAt);
          donwloadVideos(playlistData.playlist.media);
        } else {
          console.log("No new playlist. Playing from cache.", "warning");;
          playFromCache();
        }
      },
      error: function(error) {
        console.error(error);
      }
    });  
  } else {
    console.log("Offline! Loading videos from cache", "warning");
    playFromCache();
  }
}

function getPlaylist() {
  if (navigator.onLine) {
    if (!downloadInProgress) {
      console.log("Checking for new playlist.");
      $.ajax({
        url: corsUrl+playlistUrl,
        type: 'GET',
        dataType: 'json',
        success: function(data) {
          var playlistData = data.data;
          var playlistUpdatedAt = playlistData.playlist.updated_at;
          var lastupdated = window.localStorage.getItem('kfc_updated');
          if (lastupdated != playlistUpdatedAt) {
            console.log("New videos! Downloading now...", "success");
            window.localStorage.setItem('kfc_updated', playlistUpdatedAt);
            donwloadVideos(playlistData.playlist.media);
          } else {
            console.log("There is no new playlist. Playing the old one");
          }
        },
        error: function(error) {
          console.log(error, "error");
        }
      });
    }
  } else {
    console.log("Offline!", "error");
  }
}


function playFromCache() {
  var cachedplaylist = JSON.parse(window.localStorage.getItem("cached_playlist"));
  media = cachedplaylist.playlist;
  player.load(media[vidId].offlineUri);
}


function offline() {
  console.log("You are offline!");
}

function online() {
  console.log("You are back online!");
  // setTimeout(getPlaylist(), 10000);
}

function onEndEvent(event) {
  if (vidId < media.length - 1) {
    vidId++;
  } else {
    vidId = 0;
  }
  window.player.load(media[vidId].offlineUri)
}

function onErrorEvent(event) {
  // Extract the shaka.util.Error object from the event.
  onError(event.detail);
}

function onError(error) {
  // Log the error.
  console.log('Error code :' + error.code + '; Data:' + error.data, "error");
}

function selectTracks(tracks) {
  // Store the highest bandwidth variant.
  var found = tracks
    .filter(function (track) { return track.type == 'variant'; })
    .sort(function (a, b) { return a.bandwidth - b.bandwidth; })
    .pop();
  console.log('Offline Track bandwidth: ' + found.bandwidth);
  return [found];
}

function initStorage(player) {
  // Create a storage instance and configure it with optional
  // callbacks. Set the progress callback so that we visualize
  // download progress and override the track selection callback.
  window.storage = new shaka.offline.Storage(player);
  window.storage.configure({
    progressCallback: setDownloadProgress,
    trackSelectionCallback: selectTracks
  });
  window.storage.list().then(function(data){ console.log(data)});
  initPlaylist();
}

function listContent() {
  return window.storage.list();
}

function playContent(content) {
  window.player.load(content.offlineUri);
}

function removeContent(content) {
  return window.storage.remove(content.offlineUri);
}

function downloadContent(manifestUri) {
  // Construct a metadata object to be stored along side the content.
  // This can hold any information the app wants to be stored with the
  // content.
  var metadata = {
    'title': manifestUri,
    'downloaded': Date()
  };

  return window.storage.store(manifestUri, metadata);
}

/*
 * UI callback for when the download button is clicked. This will
 * disable the button while the download is in progress, start the
 * download, and refresh the content list once the download is
 * complete.
 */
function donwloadVideos(playlistArray) {
  downloadInProgress = true;
   // Disable the download button to prevent user from requesting
   // another download until this download is complete.

  setDownloadProgress(null, 0);
  var index = 0;
  var newplaylist = [];
  for (var i = 0;i < playlistArray.length;i++) {
    var url = playlistArray[i].video_link;
    console.warn(url);
    console.log("Downloading: " + url +"\n Please wait...", "info", true);
    downloadContent(url)
      .then(function (e) {
        console.log("Dowloaded! \n" +url + " \n", "success", false);
        newplaylist.push(e);
        return saveToPlaylist(e);
      })
      .then(function (content) {
        setDownloadProgress(null, 1);
        index++;
        if (index == playlistArray.length) {
          window.localStorage.setItem("cached_playlist", JSON.stringify({ playlist: newplaylist }));
          media = newplaylist;
          console.log("Playing the new playlist now!", "success");
          downloadInProgress = false;
          player.load(media[vidId].offlineUri);
        }
      })
      .catch(function (error) {
        console.log(error);
        onError(error);
      });
  };
}

// Play the videos of latest playlist
function saveToPlaylist(e) {
  return new Promise(function(resolve, reject){ resolve(playlist.push(e)) });
}

/*
 * Update the online status box at the top of the page to tell the
 * user whether or not they have an internet connection.
 */
function updateOnlineStatus() {
  if (navigator.onLine) {
    console.log("Online", "success");
  } else {
    console.log("Offline", "error");
  }
}

/*
 * Find our progress bar and set the value to show the progress we
 * have made.
 */
function setDownloadProgress(content, progress) {
  // var progressBar = document.getElementById('progress-bar');
  // progressBar.value = progress * progressBar.max;
  // console.downloadProgress(progress * 100);
}

/*
 * Clear our content table and repopulate it table with the current
 * list of downloaded content.
 */
function refreshContentList() {
  return listContent()
    .then(function (content) { 
      console.log(content)
      media.push(content);
      // content.forEach(addRow); 
    });
};

/*
 * Create a new button but do not add it to the DOM. The caller
 * will need to do that.
 */
function createButton(text, action) {
  var button = document.createElement('button');
  button.innerHTML = text;
  button.onclick = action;
  return button;
}

// console.error = function (message) {
//   toastr.options = {
//     "closeButton": false,
//     "debug": false,
//     "newestOnTop": false,
//     "progressBar": false,
//     "positionClass": "toast-top-right",
//     "preventDuplicates": false,
//     "onclick": null,
//     "showDuration": "300",
//     "hideDuration": "1000",
//     "timeOut": "5000",
//     "extendedTimeOut": "1000",
//     "showEasing": "swing",
//     "hideEasing": "linear",
//     "showMethod": "fadeIn",
//     "hideMethod": "fadeOut"
//   }
//   toastr.error(message);
// }

// console.log = function (message, type = "info") {
//   if (message.isArray || typeof message === "object") {
//     console.warn(message);
//   } else {
//     toastr.options = {
//       "closeButton": false,
//       "debug": false,
//       "newestOnTop": false,
//       "progressBar": false,
//       "positionClass": "toast-top-right",
//       "preventDuplicates": false,
//       "onclick": null,
//       "showDuration": "300",
//       "hideDuration": "1000",
//       "timeOut": "5000",
//       "extendedTimeOut": "1000",
//       "showEasing": "swing",
//       "hideEasing": "linear",
//       "showMethod": "fadeIn",
//       "hideMethod": "fadeOut"
//     }
//     toastr[type](message);
//   }
// }

// console.download = function (message, type = "info", timeOut = false) {
//   if(!timeOut) {
//     toastr.clear();
//   }
//   toastr[type](message, "", {
//     "closeButton": false,
//     "debug": false,
//     "newestOnTop": false,
//     "progressBar": false,
//     "positionClass": "toast-top-right",
//     "preventDuplicates": false,
//     "onclick": null,
//     "showDuration": "300",
//     "hideDuration": "1000",
//     "timeOut": timeOut ? 0 : "5000",
//     "extendedTimeOut": timeOut ? 0 : "1000",
//     "showEasing": "swing",
//     "hideEasing": "linear",
//     "showMethod": "fadeIn",
//     "hideMethod": "fadeOut"
//   });
// }

window.setInterval(function () {
  /// call your function here
  getPlaylist();
}, 10000);


document.addEventListener('DOMContentLoaded', initApp);