var wsUri = "wss://kfc.uws.al:6001";

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
  $("#image-container").css({ backgroundImage: "url(http://kfc.uws.al/videos/1550327715-7nloLT3.jpg)", display: "block" });
}

function hidePhoto() {
  $("#image-container").css({ display: "none" });
}

window.addEventListener("load", init, false);