# Appeerjs
A basic encapsulation of Native WebRTC, this would offer an easy to use and understand API for beginners out there

## Getting Started
1. Go to your project directory using your command line tool then install the project using npm
 
  ```shell
  npm install appeerjs
  ```
2. Include appeer.js to your index page.

  ```html
  <script type="text/javascript" src="appeer.min.js"></script>
  ```
3. You need to start the signaling server with the [appeerjs-server] ()

4. After you finish the step three you can now connect to AppeerJS

  ```javascript
  var peer = new Appeer({
    host: 'localhost',
    port: '9000'
  });
  ```
