const app     = require('./server/app')
    , config  = require('./private/config')

const SERVER_PORT = process.env.SERVER_PORT || config.SERVER_PORT
    , SERVER_URI  = process.env.SERVER_URI  || config.SERVER_URI

app.listen(SERVER_PORT, () => {
  console.log('Server listening on ' + SERVER_URI + ':' + SERVER_PORT);
});
