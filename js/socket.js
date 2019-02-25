var wsUri = "wss://kfc.uws.al:6001";
var instantImagesUri = "http://kfc.uws.al/api/v1/breakingnews/";
var baseImageUri = "http://kfc.uws.al/videos/";
var corsUrl = "https://cors-anywhere.herokuapp.com/";
var imageUri = localStorage.getItem("kfc_instant_image") || null;

function init() {
  initSocket();
}

function initSocket() {
  // Enable pusher logging - don't include this in production
  Pusher.logToConsole = true;

  var pusher = new Pusher('b69495e6f212a6f8d502', {
    cluster: 'eu',
    forceTLS: true
  });
  var screen = JSON.parse(localStorage.getItem("kfc_screen"));
  var channel = pusher.subscribe('location-' + screen.location);
  channel.bind('toggle', function (data) {
    console.log(data);
    if(data.play) {
      showPhoto();
    } else {
      hidePhoto();
    }
  });
}

function showPhoto() {
  $("#image-container").css({ display: "block" });
}

function hidePhoto() {
  $("#image-container").css({ display: "none" });
}

function checkForInstaImage() {
  var screenData = JSON.parse(localStorage.getItem("kfc_screen")) || null;
  if (navigator.onLine && screenData) {
    $.ajax({
      url: corsUrl + instantImagesUri + screenData.location + "/" + screenData.screen,
      type: 'GET',
      dataType: 'json',
      success: function (data) {
        imageUri = data[0].image;
        var lastInstaImage = window.localStorage.getItem('kfc_instant_last');
        if (lastInstaImage != imageUri) {
          window.localStorage.setItem('kfc_instant_last', imageUri);
          var image = document.getElementById("instant-image");
          var downloadingImage = new Image();
          downloadingImage.onload = function () {
            console.log("send can show image to server");
            image.src = this.src;
          };
          downloadingImage.src = baseImageUri + imageUri;
        }
      },
      error: function (error) {
        console.log(error, "error");
      }
    });
  } else {
    log("Offline!", "error");
  }
}

window.setInterval(function () {
  checkForInstaImage();
}, 60000);
window.addEventListener("load", init, false);