const { contextBridge } = require('electron');

// Exponha APIs seguras ao renderer (se precisar)
contextBridge.exposeInMainWorld('api', {
  ping: () => 'pong',
});
