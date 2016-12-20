# AppeerJS
A basic encapsulation of Native WebRTC, this would offer an easy to use and understand API for beginners out there

## Getting Started
1. Go to your project directory using your command line tool then install the project using npm.
 
  ```shell
  npm install appeerjs
  ```
2. Include socket.io and appeer.js to your index page.

  ```html
  <script type="text/javascript" src="socket.io.js"></script>
  <script type="text/javascript" src="appeer.min.js"></script>
  ```
3. You need to start the signaling server with the [appeerjs-server] (https://github.com/TMJPEngineering/appeerjs-server).

4. After finishing the step three you can now connect to AppeerJS.

  ```javascript
  var appeer = new Appeer('customId', {
    host: 'localhost',
    port: '9000',
    debug: true // Set to true to show console logs and errors, defaults to false
  });
  ```
5. Listen to the appeerjs events.

  ```javascript
  // Triggers when you successfully connects to appeerjs
  appeer.on('connection', function (event) {
    var appeerId = event.data.id;
    console.log('My appeer id is', appeerId);
  });
  
  // Triggers when the other peers is calling you
  appeer.on('call', function (event) {
    var call = event.data.call;
    
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      call.answer(stream); // Answer the call with your stream
    });
  });
  
  // Triggers when the remote peer answers the call with a stream
  appeer.on('stream', function (event) {
    var stream = event.detail.stream;
    // Do something with the stream
  });
  
  // Triggers when a peer connection has been disconnected
  appeer.on('close', function (event) {
    var appeerId = event.data.id;
    console.log('User ', peerId, 'has left the call');
  });
  
  // Triggers when connecting to appeer fails
  appeer.on('error', function (event) {
    var error = event.detail.error;
    // Handle error
  });
  ```
  
6. You can now call to a connected peer, using appeer.call.
 
  ```javascript
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
    appeer.call(appeerId, stream);
  });
  ```
  
7. You can do a conference call by joining a room first

  ```javascript
  var roomId = '1234';
  
  appeer.join(roomId);
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
    appeer.call(roomId, stream);
  });
  ```
  
8. Disconnect from a connection

  ```javascript
  var id = '123'; // Either appeer id or room id
  apppeer.close(id);
  ```

## Limitations
Currently WebRTC is not supported in all browsers.  
Please see [supported browser versions] (http://caniuse.com/#feat=rtcpeerconnection) for more information on the official support specification.

## Inspirations and Motivations 
- [PeerJS] (http://peerjs.com/)

## Credits
- [Socket.io] (http://socket.io/)
- [EventDispatcher] (https://github.com/mrdoob/eventdispatcher.js/)

## License
This project is licensed under the MIT License - see the [LICENSE] (https://github.com/TMJPEngineering/appeerjs/blob/master/LICENSE) file for details

## TODO
- [ ] Unit tests
- [x] Group conference feature
- [x] Replace Native Javascript Events with a lightweight Event Library or make a new one
- [ ] Trigger 'close' event when a single connection user has disconnected unintentionally e.g Page refresh, etc.



