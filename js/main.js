var media = [];
var playlist = [];
var vidId = 0;
var screen;
var kfcDebugMode;
var vidUrl = "http://kfc.uws.al";
var corsUrl = "";
var playlistUrl = "http://kfc.uws.al/api/v1/screens/";
var vid1 = corsUrl + "https://storage.googleapis.com/shaka-demo-assets/sintel-mp4-only/dash.mpd";
var vid2 = corsUrl + "https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd";
var downloadInProgress = false;
var lastCachedPlaylist = [];

function initApp() {
  screen = JSON.parse(localStorage.getItem("kfc_screen"));
  kfcDebugMode = JSON.parse(localStorage.getItem("kfc_debug_mode"));
  lastCachedPlaylist = JSON.parse(localStorage.getItem("cached_playlist"));
  if (!screen) {
    window.location.href = window.location.origin;
  }
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
    log('Browser not supported!', "error");
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
  var preload = document.getElementById('preload');

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

  listContent()
    .then(function (content) {
      if (content.length) {
        media = content;
      }
    });
}

function initPlaylist() {
  log("gettting data");
  if (navigator.onLine) {
    $.ajax({
      url: corsUrl + playlistUrl + screen.screen,
      type: 'GET',
      dataType: 'json',
      success: function(data) {
        console.log(data);
        var playlistData = data;
        var playlistUpdatedAt = playlistData.updated_at;
        var lastupdated = window.localStorage.getItem('kfc_updated');
        if (lastupdated != playlistUpdatedAt) {
            log("New videos! Downloading now...", "success");
            window.localStorage.setItem('kfc_updated', playlistUpdatedAt);
            if (playlistData.photo) {
              displayImage(playlistData.photo)
            } else {
              donwloadVideos(playlistData.playlist);
            }
        } else {
          log("No new playlist. Playing from cache.", "warning");
          if (playlistData.photo) {
            displayImage(playlistData.photo);
          } else {
            playFromCache();
          }
        }
      },
      error: function(error) {
        logError(error);
      }
    });  
  } else {
    log("Offline! Loading videos from cache", "warning");
    playFromCache();
  }
}

function getPlaylist() {
  if (navigator.onLine) {
    if (!downloadInProgress) {
      log("Checking for new playlist.");
      $.ajax({
        url: corsUrl + playlistUrl + screen.screen,
        type: 'GET',
        dataType: 'json',
        success: function(data) {
          var playlistData = data;
          var playlistUpdatedAt = playlistData.updated_at;
          var lastupdated = window.localStorage.getItem('kfc_updated');
          if (lastupdated != playlistUpdatedAt) {
            window.localStorage.setItem('kfc_updated', playlistUpdatedAt);
            if (playlistData.photo) {
              displayImage(playlistData.photo)
            } else {
              log("New videos! Downloading now...", "success");
              donwloadVideos(playlistData.playlist);
            }
          } else {
            log("There is no new playlist. Playing the old one");
          }
        },
        error: function(error) {
          log(error, "error");
        }
      });
    }
  } else {
    log("Offline!", "error");
  }
}

function playFromCache() {
  var cachedplaylist = JSON.parse(window.localStorage.getItem("cached_playlist"));
  console.log(cachedplaylist);
  // media = cachedplaylist.playlist;
  window.player.load(media[vidId].offlineUri);
  // preload.src = media[vidId].offlineUri;
}


function offline() {
  log("You are offline!", "error");
}

function online() {
  log("You are back online!", "success");
  // setTimeout(getPlaylist(), 10000);
}

function displayImage(image) {
  console.log("showPhoto: " + image);
  imageUri = image;
  var image = document.getElementById("playlist-image");
  var downloadingImage = new Image();
  downloadingImage.onload = function () {
    console.log("Playlist photo ready");
    image.src = this.src;
    displayPhoto();
  };
  downloadingImage.src = baseImageUri + imageUri;
}

function displayPhoto() {
  $("#playlist-image-container").css({ display: "block" });
}

function removePhoto() {
  $("#playlist-image-container").css({ display: "none" });
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
  console.log(error)
  // Log the error.
  logError('Error code :' + error.code + '; Data:' + error.data);
}

function selectTracks(tracks) {
  // Store the highest bandwidth variant.
  var found = tracks
    .filter(function (track) { return track.type == 'variant'; })
    .sort(function (a, b) { return a.bandwidth - b.bandwidth; })
    .pop();
  log('Offline Track bandwidth: ' + found.bandwidth);
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
  window.storage.list().then(function(data){ media = data;console.log(data)});
  initPlaylist();
}

function listContent() {
  return window.storage.list();
}

function playContent(content) {
  removePhoto()
  window.storage.list().then(function (data) { 
    media = data; 
    window.player.load(data[0].offlineUri);
    console.log("--- play content ----", lastCachedPlaylist)
    if (!lastCachedPlaylist) {
      initNewCachedPlaylist()
    } else {
      // storeDeleteAsset();
    }
  });
}

function initNewCachedPlaylist() {
  console.log("initNewCachedPlaylist")
  window.storage.list().then(function (data) {
    console.log("init cache playlist: ", data);
    lastCachedPlaylist = data;
    window.localStorage.setItem("cached_playlist", JSON.stringify({ playlist: data })); 
  });
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

function donwloadVideos(playlistArray, index) {
  // Disable the download button to prevent user from requesting
  // another download until this download is complete.
  if (!index) index = 0;
  if (index < playlistArray.length && !downloadInProgress) {
    setDownloadProgress(null, 0);
    downloadInProgress = true;
    var url = corsUrl + vidUrl + playlistArray[index];
    console.warn(url);
    downloadLog("Downloading: " + url + "\n Please wait...", "info", true);
    downloadContent(url)
      .then(function (e) {
        downloadLog("Dowloaded! \n" + url + " \n", "success", false);
        return saveToPlaylist(e);
      })
      .then(function (content) {
        setDownloadProgress(null, 1);
        index = index + 1;
        if (index == playlistArray.length) {
          console.log(lastCachedPlaylist)
          console.log("media", media);
          log("Playing the new playlist now!", "success");
          console.log("Playing the new playlist now!", "success");
          console.log(media);
          console.log("--- play content ----", lastCachedPlaylist)
          storeDeleteAsset(media.slice(0, media.length));
          downloadInProgress = false;
          playContent(media[vidId]);
        } else {
          downloadInProgress = false;
          donwloadVideos(playlistArray, index);
        }
      })
      .catch(function (error) {
        log(error);
        onError(error);
      });
  }
}

function storeDeleteAsset() {
  window.storage.configure(({progressCallback: function (data, percent) {}}));
  var cached_media = JSON.parse(window.localStorage.getItem("cached_playlist"));
  console.log("--- storeDeleteAsset ---", cached_media)
  console.log(storage, cached_media, storage && cached_media)
  if (storage && media) {
    console.log("media", media)
    var mediaCached = media.slice(0, media.length);
    storage.list()
    .then(function (content) {
      for (var contentIndex = 0; contentIndex < content.length; contentIndex++) {
        for (var j = 0; j < mediaCached.length;j++) {
          console.log('deleting media', mediaCached);
          if (mediaCached[j] && content[contentIndex].originalManifestUri == mediaCached[j].originalManifestUri) {
            var offlineUri = content[contentIndex].offlineUri;
            console.log("offline uri")
            console.log(offlineUri);
            return storage.remove(offlineUri).then(function (data) {
              log("Video deleted successfuly!", "success");
              console.log("media", mediaCached)
              mediaCached.shift();
              media = mediaCached;
              console.log("media shifted", content)
              console.log("--- mediaaa: ", media)
              content.shif();
              window.localStorage.setItem("cached_playlist", JSON.stringify({ playlist: content }));
              storeDeleteAsset()
            }).catch(function (reason) {
              var error = (reason);
              onError(error);
            });
          } else {
            playContent()
          }
        }
      }
    });
  }
};


// Play the videos of latest playlist
function saveToPlaylist(e) {
  console.log(e);
  return new Promise(function(resolve, reject){ resolve(playlist.push(e)) });
}

/*
 * Update the online status box at the top of the page to tell the
 * user whether or not they have an internet connection.
 */
function updateOnlineStatus() {
  if (navigator.onLine) {
    log("Online", "success");
  } else {
    log("Offline", "error");
  }
}

/*
 * Find our progress bar and set the value to show the progress we
 * have made.
 */
function setDownloadProgress(content, progress) {
  var progressBar = $("#download-progress");
  progressBar.html(Math.round(progress * 100) +'%');
}

/*
 * Clear our content table and repopulate it table with the current
 * list of downloaded content.
 */
function getContentList() {
  return listContent()
    .then(function (content) { 
      console.log(content)
      media.push(content);
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

function logError(message) {
  if (!kfcDebugMode) return;
  toastr.options = {
    "closeButton": false,
    "debug": false,
    "newestOnTop": false,
    "progressBar": false,
    "positionClass": "toast-top-right",
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "5000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
  }
  toastr.error(message);
}

function log(message, type) {
  if (!kfcDebugMode) return;
  if (!type) {
    type = "info"
  }
  toastr[type](message);
}

function downloadLog(message, type, timeOut) {
  if (!kfcDebugMode) return;
  if(!timeOut) {
    toastr.clear();
  }
  if (!type) type = "info";
  if (!timeOut) timeOut = false;
  toastr[type](message + "<br><p><div id='download-progress'></div></p>", "", {
    "closeButton": false,
    "debug": false,
    "newestOnTop": false,
    "progressBar": false,
    "positionClass": "toast-top-right",
    "preventDuplicates": false,
    "onclick": null,
    "escapeHTML": true,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": timeOut ? 0 : "5000",
    "extendedTimeOut": timeOut ? 0 : "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
  });
}

window.setInterval(function () {
  /// call your function here
  getPlaylist();
}, 4000);

// dT = new Date(Date.now() + 1 * 60000) - new Date();
// dT = new Date("Sun Feb 10 2019 14:45:21 GMT+0100 (CET)") - new Date();
// setTimeout(alert, dT, "time's up!")

document.addEventListener('DOMContentLoaded', initApp);