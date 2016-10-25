# AppeerJS
A basic encapsulation of Native WebRTC, this would offer an easy to use and understand API for beginners out there

## Getting Started
1. Go to your project directory using your command line tool then install the project using npm.
 
  ```shell
  npm install appeerjs
  ```
2. Include appeer.js to your index page.

  ```html
  <script type="text/javascript" src="appeer.min.js"></script>
  ```
3. You need to start the signaling server with the [appeerjs-server] (https://github.com/TMJPEngineering/appeerjs-server).

4. After finishing the step three you can now connect to AppeerJS.

  ```javascript
  var appeer = new Appeer({
    host: 'localhost',
    port: '9000'
  });
  ```
5. Listen to the appeerjs events.

  ```javascript
  // Triggers when you successfully connects to appeerjs
  appeer.on('connection', function (event) {
    var appeerId = event.detail.id;
    console.log('My appeer id is', appeerId);
  });
  
  // Triggers when the other peers is calling you
  appeer.on('call', function (event) {
    var call = event.detail;
    
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      appeer.answer(call, stream);
    });
  });
  
  // Triggers when the remote peer answers the call with a stream
  appeer.on('stream', function (event) {
    var stream = event.detail.stream;
    // Do something with the stream
  });
  ```
  
6. You can now call to a connected peer, using appeer.call.
 
  ```javascript
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
    appeer.call(appeerId, stream);
  });
  ```

## Limitations
Currently WebRTC is not supported in all browsers.  
Please see [supported browser versions] (http://caniuse.com/#feat=rtcpeerconnection) for more information on the official support specification.

## Inspirations and Motivations 
- [PeerJS] (http://peerjs.com/)

## Credits
- [Socket.io] (http://socket.io/)

## License
This project is licensed under the MIT License - see the [LICENSE] (https://github.com/TMJPEngineering/appeerjs/blob/master/LICENSE) file for details

## TODO
- [ ] Unit tests
- [ ] Group conference feature
- [ ] Replace Native Javascript Events with a lightweight Event Library or make a new one



