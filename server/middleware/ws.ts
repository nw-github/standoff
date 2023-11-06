const prod = process.env.NODE_ENV !== 'development';

export default defineEventHandler(event => {
    // FIXME: the Nuxt hook won't work in the production build, so this ensures the websocket will 
    // be initialized at some point. It would be better if this didn't run for every request and 
    // only once during server startup, but I can't find a way to do this at the moment.
    if (prod) {
        // @ts-ignore
        wsInit(event.node.res.socket?.server);
    }
});
