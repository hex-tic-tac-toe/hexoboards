import { EventBus } from './EventBus.js';

const Channel = {
  _routes: {},
  _transforms: {},

  connect(source, target) {
    if (!Channel._routes[source]) Channel._routes[source] = [];
    Channel._routes[source].push(target);
    return () => Channel.disconnect(source, target);
  },

  disconnect(source, target) {
    if (Channel._routes[source]) {
      Channel._routes[source] = Channel._routes[source].filter(t => t !== target);
    }
  },

  transform(source, fn) {
    Channel._transforms[source] = fn;
  },

  emit(source, data) {
    const transformed = Channel._transforms[source] ? Channel._transforms[source](data) : data;
    EventBus.emit(source, transformed);
    const targets = Channel._routes[source] || [];
    for (const target of targets) {
      EventBus.emit(target, transformed);
    }
  },
};

export { Channel };
